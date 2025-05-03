// 간단한 테스트 API 엔드포인트

module.exports = async function(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 환경 변수 정보 (민감한 정보 제외)
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    hasDiscordToken: !!process.env.DISCORD_TOKEN,
    hasDiscordWebhook: !!process.env.DISCORD_WEBHOOK_URL,
    hasMonitoredChannels: !!process.env.MONITORED_CHANNEL_IDS,
    nodeVersion: process.version,
    currentTime: new Date().toISOString()
  };
  
  return res.status(200).json({
    success: true,
    message: '테스트 API가 정상적으로 작동합니다.',
    env: envInfo,
    timestamp: new Date().toISOString()
  });
}; 