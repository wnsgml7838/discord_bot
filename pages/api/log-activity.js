import { createHash } from 'crypto';

// 환경변수에서 Discord Webhook URL을 가져오거나 직접 설정할 수 있습니다.
// DISCORD_WEBHOOK_URL은 Vercel 대시보드나 .env 파일에 설정해야 합니다.
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * 사용자 활동을 Discord Webhook으로 전송하는 API 엔드포인트
 * @param {object} req - 요청 객체 (사용자 활동 정보 포함)
 * @param {object} res - 응답 객체
 */
export default async function handler(req, res) {
  // POST 요청이 아닌 경우 405 응답
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 요청 본문에서 이벤트 데이터 추출
    const { event, userId, page, metadata } = req.body;

    // 필수 데이터 검증
    if (!event) {
      return res.status(400).json({ error: 'Event is required' });
    }

    // 요청자 IP 해시화 (개인정보 보호)
    const userIpHash = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const hashedIp = createHash('sha256').update(userIpHash || 'unknown').digest('hex').substring(0, 10);

    // Discord에 전송할 메시지 구성
    const message = {
      embeds: [{
        title: `📊 사용자 활동: ${event}`,
        color: 0x00AAFF, // 파란색
        fields: [
          { name: '이벤트', value: event, inline: true },
          { name: '페이지', value: page || 'Not specified', inline: true },
          { name: '사용자 ID', value: userId || 'Anonymous', inline: true },
          { name: '시간', value: new Date().toISOString(), inline: true },
          { name: '해시된 IP', value: hashedIp, inline: true },
          { name: 'User Agent', value: req.headers['user-agent'] || 'Unknown', inline: false }
        ],
        footer: { text: 'Vercel 앱 사용자 활동 로그' },
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

    // Discord Webhook URL이 설정되지 않았거나 테스트 모드인 경우 콘솔에 로그만 출력
    // 테스트 모드 확인 (metadata에 test=true 또는 test_mode=true 설정)
    const isTestMode = metadata && (metadata.test === true || metadata.test_mode === true);
    
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK') || isTestMode) {
      console.log('로깅 이벤트 (테스트 모드 또는 Webhook URL 미설정):', JSON.stringify(message, null, 2));
      return res.status(200).json({ 
        success: true, 
        message: 'Event logged to console (Test mode or Webhook URL not configured)',
        data: message
      });
    }

    // Discord Webhook으로 메시지 전송
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    // 응답 처리
    if (response.ok) {
      return res.status(200).json({ success: true, message: 'Event logged successfully' });
    } else {
      const errorData = await response.text();
      console.error('Failed to send Discord webhook:', errorData);
      return res.status(500).json({ success: false, error: 'Failed to send Discord webhook', details: errorData });
    }
  } catch (error) {
    console.error('Error logging event:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
  }
} 