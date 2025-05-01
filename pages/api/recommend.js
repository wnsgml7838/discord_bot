// API 엔드포인트: 백준 문제 추천
import { exec } from 'child_process';
import path from 'path';
import { createHash } from 'crypto';

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
        footer: { text: 'Vercel 백준 API 활동 로그' },
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
 * 백준 문제 추천 API 핸들러
 * @param {object} req - HTTP 요청 객체
 * @param {object} res - HTTP 응답 객체
 */
export default async function handler(req, res) {
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메소드입니다.' });
  }

  try {
    const { handle, page = 1 } = req.body;

    // 필수 파라미터 검증
    if (!handle) {
      await logServerActivity('baekjoon_api_error', { error: '백준 ID 누락', method: req.method }, req);
      return res.status(400).json({ error: '백준 ID는 필수입니다.' });
    }

    // 페이지 번호 검증
    const pageNum = parseInt(page, 10) || 1;
    if (pageNum < 1) {
      await logServerActivity('baekjoon_api_error', { error: '유효하지 않은 페이지', handle, page }, req);
      return res.status(400).json({ error: '유효하지 않은 페이지 번호입니다.' });
    }

    // API 호출 로깅
    await logServerActivity('baekjoon_api_call', { handle, page: pageNum }, req);

    // 스크립트 경로
    const scriptPath = path.join(process.cwd(), 'bot', 'commands', 'baekjoon_recommender.py');
    
    console.log(`백준 문제 추천 시작: ${handle}, 페이지: ${pageNum}`);
    console.log(`실행 경로: python ${scriptPath} ${handle} ${pageNum}`);

    // Python 스크립트 실행
    exec(`python ${scriptPath} ${handle} ${pageNum}`, {
      timeout: 30000 // 30초 타임아웃
    }, async (error, stdout, stderr) => {
      if (error) {
        console.error('백준 문제 추천 오류:', error.message);
        console.error('STDERR:', stderr);
        
        // 오류 로깅
        await logServerActivity('baekjoon_api_exec_error', { 
          handle, 
          page: pageNum,
          error: error.message,
          stderr
        }, req);
        
        return res.status(500).json({ 
          error: '백준 문제 추천 중 오류가 발생했습니다.',
          details: error.message
        });
      }
      
      if (stderr) {
        console.warn('백준 문제 추천 경고:', stderr);
      }
      
      console.log('백준 문제 추천 완료');
      
      // stdout에서 HTML 결과 부분만 추출
      // 시작 표시: <h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제
      // 또는 시작부터 끝까지의 출력이 HTML 결과일 수 있음
      let result = stdout;
      let noResults = false;
      
      // HTML 시작 부분을 찾습니다
      const htmlStartIndex = stdout.indexOf("<h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제");
      
      if (htmlStartIndex !== -1) {
        // HTML 부분만 추출합니다
        result = stdout.substring(htmlStartIndex);
      } else if (stdout.includes("현재 조건에 맞는 추천 문제를 찾을 수 없습니다")) {
        // 결과가 없는 경우 기본 메시지 생성
        result = `<h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제</h2>
                  <div class='border-t-4 border-black my-3'></div>
                  <div class='py-4 text-black font-black bg-red-200 p-2 rounded-md'>현재 조건에 맞는 추천 문제를 찾을 수 없습니다.</div>`;
        noResults = true;
      }
      
      // 사용자 정보 추출 (있는 경우)
      let userTier = "정보 없음";
      const tierMatch = stdout.match(/사용자 티어: (.+)/);
      if (tierMatch && tierMatch[1]) {
        userTier = tierMatch[1];
      }
      
      // 결과 로깅
      await logServerActivity('baekjoon_api_result', { 
        handle, 
        page: pageNum,
        user_tier: userTier,
        no_results: noResults
      }, req);
      
      return res.status(200).json({ 
        success: true, 
        result: result,
        userInfo: {
          handle,
          tier: userTier
        },
        page: pageNum
      });
    });
  } catch (error) {
    console.error('백준 문제 추천 처리 중 예외 발생:', error);
    
    // 예외 로깅
    await logServerActivity('baekjoon_api_exception', { 
      error: error.message,
      stack: error.stack
    }, req);
    
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
} 