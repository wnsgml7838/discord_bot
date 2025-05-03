/**
 * pages/api/cron-logger.js
 * Vercel 서버리스 함수로 일일 활동 로그를 처리합니다.
 * Vercel Cron Jobs을 통해 하루에 한 번 호출됩니다. (Hobby 플랜 제한)
 */

// 필요한 환경변수: DISCORD_WEBHOOK_URL

export default async function handler(req, res) {
  // GET 요청만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { authorization } = req.headers;
    
    // 간단한 API 키 검증 (실제 구현에서는 더 안전한 방법 사용)
    // 환경변수에 API_CRON_SECRET을 설정해야 합니다.
    if (process.env.API_CRON_SECRET && authorization !== `Bearer ${process.env.API_CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Discord Webhook URL이 설정되어 있는지 확인
    if (!process.env.DISCORD_WEBHOOK_URL) {
      console.log('Discord Webhook URL is not configured.');
      return res.status(500).json({ error: 'Discord Webhook URL is not configured' });
    }

    // 현재 날짜 정보
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[now.getDay()];

    // 현재 서버 상태 정보 수집
    const statusInfo = {
      timestamp: now.toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };

    // Discord로 일일 상태 메시지 전송
    const message = {
      embeds: [{
        title: '📊 일일 서버 상태 보고',
        description: `${dateStr} (${dayOfWeek}) 일일 서버 상태 보고서입니다.`,
        color: 0x00FF00, // 녹색
        fields: [
          { name: '날짜', value: dateStr, inline: true },
          { name: '요일', value: dayOfWeek, inline: true },
          { name: '환경', value: statusInfo.environment, inline: true },
          { name: '서버 가동 시간', value: `${Math.floor(statusInfo.uptime / 60 / 60)} 시간`, inline: true },
          { name: '메모리 사용량', value: `${Math.round(statusInfo.memory.rss / 1024 / 1024)} MB`, inline: true },
          { name: '실행 주기', value: 'Hobby 플랜: 하루에 한 번 (매일 정오)', inline: false },
        ],
        footer: { text: 'Vercel Hobby 플랜 일일 크론 작업' },
        timestamp: now.toISOString()
      }]
    };

    // Discord Webhook으로 메시지 전송
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      return res.status(200).json({ 
        success: true, 
        message: '일일 상태 보고가 성공적으로 전송되었습니다.',
        date: dateStr,
        day: dayOfWeek
      });
    } else {
      const errorData = await response.text();
      console.error('Discord 웹훅 전송 실패:', errorData);
      return res.status(500).json({ 
        success: false, 
        error: 'Discord 웹훅 전송 실패', 
        details: errorData,
        date: dateStr
      });
    }
  } catch (error) {
    console.error('cron-logger 오류:', error);
    return res.status(500).json({ 
      success: false, 
      error: '내부 서버 오류', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 