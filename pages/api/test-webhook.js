/**
 * 웹훅 테스트 API 엔드포인트
 * 
 * 이 API는 Discord 웹훅이 제대로 작동하는지 테스트하기 위한 것입니다.
 * 호출 시 웹훅으로 테스트 메시지를 보냅니다.
 */

// 환경 변수
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// 동적 로깅 헬퍼 함수
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : '🔄';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

/**
 * Discord 웹훅으로 테스트 메시지 전송
 */
async function sendTestWebhook() {
  if (!DISCORD_WEBHOOK_URL) {
    log('Discord 웹훅 URL이 설정되지 않았습니다', 'error');
    return {
      success: false,
      error: 'Discord 웹훅 URL이 설정되지 않았습니다'
    };
  }

  try {
    const payload = {
      embeds: [
        {
          title: '🧪 웹훅 테스트',
          description: `이것은 API 테스트 메시지입니다.\n\n호출 시간: ${new Date().toISOString()}`,
          color: 0x00ffff,
          fields: [
            {
              name: '환경 정보',
              value: `Node.js: ${process.version}\nAPI 경로: /api/test-webhook`
            }
          ],
          footer: {
            text: '웹훅 테스트 완료'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    log(`웹훅 전송 시도: ${DISCORD_WEBHOOK_URL}`);
    
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord 응답 오류: ${response.status} ${errorText}`);
    }
    
    log('웹훅 메시지가 성공적으로 전송되었습니다');
    return { success: true };
  } catch (error) {
    log(`웹훅 전송 실패: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * API 핸들러 함수
 */
module.exports = async function(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const result = await sendTestWebhook();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: '웹훅 테스트가 성공적으로 완료되었습니다',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    log(`API 오류: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      error: `API 오류: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}; 