import { Octokit } from '@octokit/rest';

export default async function handler(req, res) {
  // HTTP 메소드 검사
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '지원하지 않는 메소드입니다.' });
  }

  console.log('API 호출됨: logs');
  console.log('환경변수 확인:', {
    token: process.env.GITHUB_TOKEN ? `${process.env.GITHUB_TOKEN.substring(0, 5)}...` : '없음',
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO
  });

  try {
    // GitHub API 클라이언트 초기화
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
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
    
    // 로그 파일 경로
    const logFilePath = 'public/image_log.json';
    
    try {
      console.log('GitHub API 요청 시작...');
      // GitHub에서 로그 파일 내용 가져오기
      const response = await octokit.repos.getContent({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        path: logFilePath
      });
      
      console.log('GitHub API 응답 성공:', response.status);
      
      // base64로 인코딩된 내용을 디코딩
      const content = Buffer.from(response.data.content, 'base64').toString();
      
      // JSON 형식으로 파싱
      let logs = JSON.parse(content);
      
      // 최신순으로 정렬
      logs = logs.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateB - dateA;
      });
      
      return res.status(200).json(logs);
    } catch (error) {
      console.error('GitHub API 오류:', error.message, error.status);
      
      // 파일이 존재하지 않는 경우
      if (error.status === 404) {
        console.log('로그 파일을 찾을 수 없음, 빈 배열 반환');
        return res.status(200).json([]);
      }
      
      throw error;
    }
  } catch (error) {
    console.error('로그 데이터 조회 오류:', error);
    return res.status(500).json({ 
      message: '서버 오류 발생', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 