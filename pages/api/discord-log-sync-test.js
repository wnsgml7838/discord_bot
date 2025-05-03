/**
 * 디스코드 로그 동기화 테스트 API
 * 디스코드 로그 동기화 기능이 제대로 작동하는지 확인하기 위한 테스트 엔드포인트
 */

export default async function handler(req, res) {
  try {
    // 환경 변수 확인
    const envVars = {
      hasDiscordToken: !!process.env.DISCORD_TOKEN,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasGithubOwner: !!process.env.GITHUB_OWNER,
      hasGithubRepo: !!process.env.GITHUB_REPO,
      monitoredChannels: process.env.MONITORED_CHANNEL_IDS ? 
        process.env.MONITORED_CHANNEL_IDS.split(',') : [],
      hasWebhook: !!process.env.DISCORD_WEBHOOK_URL
    };

    // 웹훅 테스트 (요청에 test-webhook=true 파라미터가 있는 경우)
    if (req.query['test-webhook'] === 'true' && process.env.DISCORD_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '🔄 테스트 웹훅 메시지',
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
    }

    // 기본 응답 (환경 변수 상태만 반환)
    return res.status(200).json({
      success: true,
      message: 'Discord 로그 동기화 테스트 API가 정상적으로 작동 중입니다.',
      config: envVars
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `테스트 API 오류: ${error.message}`
    });
  }
} 