/**
 * 간단한 디스코드 로그 동기화 API (하루 한 번 실행)
 */

// 환경 변수
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MONITORED_CHANNEL_IDS = process.env.MONITORED_CHANNEL_IDS ? 
  process.env.MONITORED_CHANNEL_IDS.split(',') : [];

module.exports = async function(req, res) {
  try {
    // 현재 날짜 정보 추출
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    // 요일 한글로 변환
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[now.getDay()];
    
    // 웹훅을 통해 일일 보고서 메시지 보내기
    if (DISCORD_WEBHOOK_URL) {
      try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '📅 일일 로그 동기화',
              description: `${dateStr} (${dayOfWeek}) 일일 로그 동기화가 실행되었습니다.\n\n실행 시간: ${timeStr}`,
              color: 0x00ff00,
              fields: [
                {
                  name: '모니터링 채널',
                  value: MONITORED_CHANNEL_IDS.length > 0 ? 
                    MONITORED_CHANNEL_IDS.join(', ') : 
                    '설정된 채널 없음'
                },
                {
                  name: '동기화 주기',
                  value: 'Hobby 플랜: 하루 한 번 실행 (매일 자정)'
                },
                {
                  name: '주요 현황',
                  value: '지난 24시간 동안의 활동을 수집합니다.'
                }
              ],
              timestamp: new Date().toISOString()
            }]
          })
        });
        
        if (response.ok) {
          return res.status(200).json({
            success: true,
            message: '일일 로그 동기화 메시지가 성공적으로 전송되었습니다.',
            date: dateStr,
            time: timeStr,
            config: {
              monitoredChannels: MONITORED_CHANNEL_IDS,
              hasWebhook: true
            }
          });
        } else {
          const errorText = await response.text();
          throw new Error(`웹훅 요청 실패: ${response.status} ${errorText}`);
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: `웹훅 전송 실패: ${error.message}`,
          date: dateStr,
          time: timeStr,
          config: {
            monitoredChannels: MONITORED_CHANNEL_IDS,
            hasWebhook: !!DISCORD_WEBHOOK_URL
          }
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Discord 웹훅 URL이 설정되지 않았습니다',
        date: dateStr,
        time: timeStr,
        config: {
          monitoredChannels: MONITORED_CHANNEL_IDS,
          hasWebhook: false
        }
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `API 오류: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
} 