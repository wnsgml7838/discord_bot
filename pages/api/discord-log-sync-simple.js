/**
 * 간단한 디스코드 로그 동기화 API
 */

// 환경 변수
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MONITORED_CHANNEL_IDS = process.env.MONITORED_CHANNEL_IDS ? 
  process.env.MONITORED_CHANNEL_IDS.split(',') : [];

module.exports = async function(req, res) {
  try {
    // 웹훅을 통해 디버그 메시지 보내기
    if (DISCORD_WEBHOOK_URL) {
      try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '📝 Simple 로그 동기화',
              description: '간단한 로그 동기화 API가 호출되었습니다.\n\n현재 시간: ' + new Date().toISOString(),
              color: 0x00ff00,
              fields: [
                {
                  name: '모니터링 채널',
                  value: MONITORED_CHANNEL_IDS.length > 0 ? 
                    MONITORED_CHANNEL_IDS.join(', ') : 
                    '설정된 채널 없음'
                }
              ],
              timestamp: new Date().toISOString()
            }]
          })
        });
        
        if (response.ok) {
          return res.status(200).json({
            success: true,
            message: '웹훅 메시지가 성공적으로 전송되었습니다.',
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
        config: {
          monitoredChannels: MONITORED_CHANNEL_IDS,
          hasWebhook: false
        }
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `API 오류: ${error.message}`
    });
  }
} 