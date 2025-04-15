import { Octokit } from '@octokit/rest';

// GitHub에서 로그 파일과 SHA 가져오기
async function getLogFileFromGitHub(octokit, owner, repo, path) {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    
    // base64로 인코딩된 내용을 디코딩
    const content = Buffer.from(response.data.content, 'base64').toString();
    
    // JSON 형식으로 파싱
    const logs = JSON.parse(content);
    
    return {
      logs,
      sha: response.data.sha
    };
  } catch (error) {
    // 파일이 존재하지 않는 경우
    if (error.status === 404) {
      return {
        logs: [],
        sha: null
      };
    }
    
    throw error;
  }
}

// GitHub에 로그 파일 업데이트
async function updateLogFileOnGitHub(octokit, owner, repo, path, logs, sha) {
  const content = Buffer.from(JSON.stringify(logs, null, 2)).toString('base64');
  
  const params = {
    owner,
    repo,
    path,
    message: `이미지 로그 업데이트 (${new Date().toISOString()})`,
    content,
    committer: {
      name: 'Log Manager',
      email: 'log-manager@noreply.github.com'
    }
  };
  
  // 파일이 이미 존재하는 경우 SHA 추가
  if (sha) {
    params.sha = sha;
  }
  
  const response = await octokit.repos.createOrUpdateFileContents(params);
  return response.data.content.sha;
}

export default async function handler(req, res) {
  console.log('API 호출됨: logs, 메소드:', req.method);
  
  // 환경 변수 확인
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
    console.error('GitHub 설정 누락:', { 
      token: process.env.GITHUB_TOKEN ? '설정됨' : '없음',
      owner: process.env.GITHUB_OWNER, 
      repo: process.env.GITHUB_REPO 
    });
    
    return res.status(500).json({ 
      message: 'GitHub 설정이 올바르지 않습니다. 환경 변수를 확인해주세요.',
      missingVars: {
        token: !process.env.GITHUB_TOKEN,
        owner: !process.env.GITHUB_OWNER,
        repo: !process.env.GITHUB_REPO
      }
    });
  }
  
  try {
    // GitHub API 클라이언트 초기화
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    // 로그 파일 경로
    const logFilePath = 'public/image_log.json';
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    
    // GET 요청 - 로그 데이터 조회
    if (req.method === 'GET') {
      console.log('로그 데이터 조회 요청');
      
      const { logs } = await getLogFileFromGitHub(octokit, owner, repo, logFilePath);
      
      // 최신순으로 정렬
      const sortedLogs = logs.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
      
      return res.status(200).json(sortedLogs);
    }
    
    // POST 요청 - 로그 데이터 추가
    else if (req.method === 'POST') {
      console.log('로그 데이터 추가 요청');
      
      // 요청 본문 확인
      if (!req.body || !req.body.nickname || !req.body.image_url) {
        return res.status(400).json({ message: '필수 필드가 누락되었습니다.' });
      }
      
      // 클라이언트가 제공한 타임스탬프 사용 또는 현재 시간 사용
      const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
      
      // 새 로그 항목 생성
      const newLog = {
        nickname: req.body.nickname,
        timestamp: timestamp.toISOString(),
        timestampStr: timestamp.toISOString().replace('T', ' ').substr(0, 19),
        image_url: req.body.image_url,
        problemCount: req.body.problemCount || null,
        messageId: req.body.messageId || `manual-${Date.now()}`
      };
      
      // 로그에 기록
      console.log('새 로그 항목 생성:', {
        nickname: newLog.nickname,
        timestamp: newLog.timestamp,
        customTimestamp: !!req.body.timestamp
      });
      
      // 기존 로그 데이터 가져오기
      const { logs, sha } = await getLogFileFromGitHub(octokit, owner, repo, logFilePath);
      
      // 새 로그 항목 추가
      logs.push(newLog);
      
      // 최신순으로 정렬
      logs.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
      
      // GitHub에 업데이트
      await updateLogFileOnGitHub(octokit, owner, repo, logFilePath, logs, sha);
      
      return res.status(200).json({
        message: '로그 데이터가 추가되었습니다.',
        log: newLog
      });
    }
    
    // PUT 요청 - 로그 데이터 수정
    else if (req.method === 'PUT') {
      console.log('로그 데이터 수정 요청');
      
      // 요청 본문 확인
      if (!req.body || !req.body.id) {
        return res.status(400).json({ message: 'ID 필드가 누락되었습니다.' });
      }
      
      // 기존 로그 데이터 가져오기
      const { logs, sha } = await getLogFileFromGitHub(octokit, owner, repo, logFilePath);
      
      // 수정할 로그 항목 찾기 (timestamp를 ID로 사용)
      console.log('로그 데이터 수정 요청 ID:', req.body.id);
      
      // 더 유연한 비교를 위해 타임스탬프 형식 처리
      const logIndex = logs.findIndex(log => {
        // 정확히 같은 경우
        if (log.timestamp === req.body.id) return true;
        
        try {
          // ISO 문자열의 날짜 부분까지만 비교 (밀리초 제외)
          const reqDate = new Date(req.body.id).toISOString().split('.')[0];
          const logDate = new Date(log.timestamp).toISOString().split('.')[0];
          return reqDate === logDate;
        } catch (e) {
          console.error('타임스탬프 비교 오류:', e);
          return false;
        }
      });
      
      console.log('찾은 로그 인덱스:', logIndex);
      
      if (logIndex === -1) {
        console.log('로그 항목을 찾지 못함. 전체 로그 타임스탬프:', logs.map(log => log.timestamp));
        return res.status(404).json({ message: '해당 ID의 로그 항목을 찾을 수 없습니다.' });
      }
      
      // 로그 항목 업데이트
      if (req.body.nickname) logs[logIndex].nickname = req.body.nickname;
      if (req.body.image_url) logs[logIndex].image_url = req.body.image_url;
      if (req.body.problemCount !== undefined) logs[logIndex].problemCount = req.body.problemCount;
      
      // 타임스탬프 업데이트가 필요한 경우
      if (req.body.timestamp) {
        const newDate = new Date(req.body.timestamp);
        logs[logIndex].timestamp = newDate.toISOString();
        logs[logIndex].timestampStr = newDate.toISOString().replace('T', ' ').substr(0, 19);
      }
      
      // 최신순으로 정렬
      logs.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
      
      // GitHub에 업데이트
      await updateLogFileOnGitHub(octokit, owner, repo, logFilePath, logs, sha);
      
      return res.status(200).json({
        message: '로그 데이터가 수정되었습니다.',
        log: logs[logIndex]
      });
    }
    
    // DELETE 요청 - 로그 데이터 삭제
    else if (req.method === 'DELETE') {
      console.log('로그 데이터 삭제 요청');
      
      // 요청 본문 확인
      if (!req.body || !req.body.id) {
        return res.status(400).json({ message: 'ID 필드가 누락되었습니다.' });
      }
      
      // 기존 로그 데이터 가져오기
      const { logs, sha } = await getLogFileFromGitHub(octokit, owner, repo, logFilePath);
      
      // 삭제할 로그 항목 찾기 (timestamp를 ID로 사용)
      console.log('로그 데이터 삭제 요청 ID:', req.body.id);
      
      // 더 유연한 비교를 위해 타임스탬프 형식 처리
      const logIndex = logs.findIndex(log => {
        // 정확히 같은 경우
        if (log.timestamp === req.body.id) return true;
        
        try {
          // ISO 문자열의 날짜 부분까지만 비교 (밀리초 제외)
          const reqDate = new Date(req.body.id).toISOString().split('.')[0];
          const logDate = new Date(log.timestamp).toISOString().split('.')[0];
          return reqDate === logDate;
        } catch (e) {
          console.error('타임스탬프 비교 오류:', e);
          return false;
        }
      });
      
      console.log('찾은 로그 인덱스:', logIndex);
      
      if (logIndex === -1) {
        console.log('로그 항목을 찾지 못함. 전체 로그 타임스탬프:', logs.map(log => log.timestamp));
        return res.status(404).json({ message: '해당 ID의 로그 항목을 찾을 수 없습니다.' });
      }
      
      // 로그 항목 삭제
      const deletedLog = logs.splice(logIndex, 1)[0];
      
      // GitHub에 업데이트
      await updateLogFileOnGitHub(octokit, owner, repo, logFilePath, logs, sha);
      
      return res.status(200).json({
        message: '로그 데이터가 삭제되었습니다.',
        log: deletedLog
      });
    }
    
    // 지원하지 않는 메소드
    else {
      return res.status(405).json({ message: '지원하지 않는 메소드입니다.' });
    }
  } catch (error) {
    console.error('로그 데이터 처리 오류:', error);
    return res.status(500).json({ 
      message: '서버 오류 발생', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 