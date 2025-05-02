/**
 * /pages/api/logImage.js
 * 이미지 로그를 기록하기 위한 API 엔드포인트
 * Vercel 서버리스 환경에서 24/7 동작하는 로깅 시스템
 */

import { Octokit } from "@octokit/rest";
import dotenv from 'dotenv';

// 로컬 환경에서 .env 파일 로드 (Vercel 환경에서는 환경 변수 설정 필요)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// GitHub 연결 설정
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'wnsgml7838';
const GITHUB_REPO = process.env.GITHUB_REPO || 'discord_bot';
const LOG_FILE_PATH = 'public/image_log.json';

// GitHub API 클라이언트 초기화
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// 로그 데이터용 변수
let logData = [];
let fileSha = null;

/**
 * GitHub에서 로그 파일 가져오기
 */
async function getLogFileFromGitHub() {
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
    });

    // 파일의 SHA 저장 (업데이트 시 필요)
    fileSha = response.data.sha;
    
    // Base64로 인코딩된 콘텐츠 디코딩
    const content = Buffer.from(response.data.content, 'base64').toString();
    
    // JSON 파싱
    try {
      logData = JSON.parse(content);
      console.log(`GitHub에서 ${logData.length}개의 로그 항목을 불러왔습니다.`);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      logData = [];
    }
    
    return logData;
  } catch (error) {
    // 파일이 없는 경우
    if (error.status === 404) {
      console.log('GitHub에 로그 파일이 없습니다. 새로 생성합니다.');
      logData = [];
      return [];
    }
    
    console.error('GitHub 로그 파일 가져오기 오류:', error);
    throw error;
  }
}

/**
 * GitHub에 로그 파일 업데이트
 */
async function updateLogFileOnGitHub() {
  try {
    const content = Buffer.from(JSON.stringify(logData, null, 2)).toString('base64');
    
    const params = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
      message: `이미지 로그 업데이트 (${new Date().toISOString()})`,
      content: content,
      committer: {
        name: 'Vercel API Bot',
        email: 'vercel-api-bot@noreply.github.com'
      }
    };
    
    // 파일이 이미 존재하는 경우 SHA 추가
    if (fileSha) {
      params.sha = fileSha;
    }
    
    const response = await octokit.repos.createOrUpdateFileContents(params);
    
    // 새 SHA 저장
    fileSha = response.data.content.sha;
    console.log('로그 파일이 GitHub에 업데이트되었습니다.');
    
    return response;
  } catch (error) {
    console.error('GitHub 로그 파일 업데이트 오류:', error);
    throw error;
  }
}

/**
 * API 핸들러 함수
 */
export default async function handler(req, res) {
  // POST 메소드만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // GitHub 토큰 확인
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ 
        error: 'GitHub 토큰이 설정되지 않았습니다.',
        env: process.env.NODE_ENV
      });
    }

    // 요청 본문 확인
    const { nickname, image_url, messageId, serverId, serverName } = req.body;

    if (!nickname || !image_url) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다. (nickname, image_url)' });
    }

    // IP 주소 (익명화됨)
    const forwardedFor = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipHash = await hashIP(forwardedFor);

    // 사용자 에이전트
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 로그 데이터가 비어있으면 GitHub에서 가져오기
    if (logData.length === 0 && !fileSha) {
      await getLogFileFromGitHub();
    }

    // 현재 시간
    const timestamp = new Date();
    const utcTimestampStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
    
    // KST 타임스탬프 (UTC+9)
    const kstTimestamp = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000);
    const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').substr(0, 19);

    // 로그 데이터 추가
    const newLog = {
      nickname,
      timestamp: timestamp.toISOString(),
      timestampStr: utcTimestampStr,
      kstTimestampStr,
      image_url,
      messageId: messageId || `api-${Date.now()}`,
      serverId: serverId || 'api-request',
      serverName: serverName || 'API Request',
      ipHash,
      userAgent: userAgent.substring(0, 100) // 너무 길지 않게 자름
    };

    // 로그 데이터에 새 항목 추가
    logData.push(newLog);

    // 날짜를 기준으로 내림차순 정렬 (최신순)
    logData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // GitHub에 업데이트
    await updateLogFileOnGitHub();

    // 성공 응답
    return res.status(200).json({ 
      success: true, 
      message: '이미지 로그가 성공적으로 저장되었습니다.', 
      timestamp: timestamp.toISOString() 
    });

  } catch (error) {
    console.error('API 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message
    });
  }
}

/**
 * IP 주소를 해시화하는 도우미 함수 (개인정보 보호)
 */
async function hashIP(ip) {
  try {
    // crypto 모듈 사용
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(ip + process.env.IP_HASH_SALT || 'default-salt');
    return hash.digest('hex').substring(0, 16); // 앞 16자만 사용
  } catch (error) {
    console.error('IP 해싱 오류:', error);
    return 'unknown';
  }
} 