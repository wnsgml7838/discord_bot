/**
 * 간단한 웹훅 테스트 API 엔드포인트
 */

module.exports = async function(req, res) {
  try {
    // 환경 변수 확인
    const envVars = {
      hasDiscordToken: !!process.env.DISCORD_TOKEN,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasGithubOwner: !!process.env.GITHUB_OWNER,
      hasGithubRepo: !!process.env.GITHUB_REPO,
      monitoredChannels: process.env.MONITORED_CHANNEL_IDS ? 
        process.env.MONITORED_CHANNEL_IDS.split(',') : [],
      hasWebhook: !!process.env.DISCORD_WEBHOOK_URL,
      hasWebhookPublic: !!process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL
    };

    // 웹훅 테스트
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '🔄 웹훅 테스트',
              description: '디스코드 웹훅 테스트 메시지입니다. 이 메시지가 보이면 웹훅이 정상적으로 작동하고 있습니다.',
              color: 0x00aaff,
              timestamp: new Date().toISOString()
            }]
          })
        });
        
        if (webhookResponse.ok) {
          return res.status(200).json({
            success: true,
            message: '웹훅 테스트 메시지가 성공적으로 전송되었습니다.',
            config: envVars
          });
        } else {
          const errorText = await webhookResponse.text();
          throw new Error(`웹훅 요청 실패: ${webhookResponse.status} ${errorText}`);
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: `웹훅 테스트 실패: ${error.message}`,
          config: envVars
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Discord 웹훅 URL이 설정되지 않았습니다',
        config: envVars
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `테스트 API 오류: ${error.message}`
    });
  }
} 