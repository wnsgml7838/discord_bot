// API 엔드포인트: Discord 봇의 백준 문제 추천 기능 사용
import { exec } from 'child_process';
import { createHash } from 'crypto';
import { recommendBaekjoonProblems } from '../../bot/discord_bot_problem_recommender';

// Discord Webhook URL 설정
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * 서버 측에서 활동을 로깅하는 함수
 * @param {string} event - 이벤트 이름
 * @param {Object} metadata - 추가 메타데이터
 * @param {Object} req - HTTP 요청 객체
 */
async function logServerActivity(event, metadata, req) {
  try {
    // 요청자 IP 해시화 (개인정보 보호)
    const userIpHash = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const hashedIp = createHash('sha256').update(userIpHash || 'unknown').digest('hex').substring(0, 10);

    // Discord에 전송할 메시지 구성
    const message = {
      embeds: [{
        title: `📊 백준 API 호출: ${event}`,
        color: 0x00AAFF, // 파란색
        fields: [
          { name: '이벤트', value: event, inline: true },
          { name: '시간', value: new Date().toISOString(), inline: true },
          { name: '해시된 IP', value: hashedIp, inline: true },
          { name: 'User Agent', value: req.headers['user-agent'] || 'Unknown', inline: false }
        ],
        footer: { text: 'Discord 봇 백준 API 활동 로그' },
        timestamp: new Date().toISOString()
      }]
    };

    // 추가 메타데이터가 있는 경우 필드에 추가
    if (metadata) {
      message.embeds[0].fields.push({
        name: '추가 데이터',
        value: '```json\n' + JSON.stringify(metadata, null, 2) + '\n```',
        inline: false
      });
    }

    // Discord Webhook URL이 설정되어 있는지 확인
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
      console.log('Discord Webhook URL is not configured. API log:', message);
      return;
    }

    // Discord Webhook으로 메시지 전송
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('로깅 실패:', error);
  }
}

/**
 * API 핸들러: 직접 Discord 봇의 추천 로직 사용
 */
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메소드입니다.' });
  }
  
  // 요청 바디 파싱
  const { handle, page = 1 } = req.body;
  
  if (!handle) {
    return res.status(400).json({ error: '백준 아이디를 입력해주세요.' });
  }
  
  try {
    // 로깅
    await logServerActivity('discord_bot_recommend', { handle, page }, req);
    
    console.log(`Discord 봇의 백준 문제 추천 함수 호출: ${handle}, 페이지: ${page}`);
    
    // Discord 봇의 추천 함수 직접 호출
    const result = await recommendBaekjoonProblems(handle, page);
    
    // 응답 반환
    res.status(200).json({ 
      success: true, 
      result 
    });
  } catch (error) {
    console.error('백준 문제 추천 오류:', error);
    
    // 오류 로깅
    await logServerActivity('discord_bot_recommend_error', { 
      handle, 
      page,
      error: error.message || '알 수 없는 오류'
    }, req);
    
    res.status(500).json({ 
      error: '백준 문제 추천 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류') 
    });
  }
} 