/**
 * 디스코드 로그 동기화 디버깅 API
 */

const { Client, GatewayIntentBits } = require('discord.js');

// 환경 변수
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MONITORED_CHANNEL_IDS = process.env.MONITORED_CHANNEL_IDS ? 
  process.env.MONITORED_CHANNEL_IDS.split(',') : [];

/**
 * 웹훅 로깅 함수
 */
async function logToWebhook(message) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('Webhook URL이 설정되지 않았습니다:', message);
    return null;
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🐞 디버그 로그',
          description: message,
          color: 0xff0000,
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('웹훅 로깅 오류:', error);
    return false;
  }
}

/**
 * Discord 채널에서 최근 메시지 가져오기
 */
async function fetchRecentMessages(client, channelId, since) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      return { error: `채널 ID ${channelId}를 찾을 수 없습니다.` };
    }
    
    const messages = await channel.messages.fetch({ limit: 5 });
    const filteredMessages = Array.from(messages.values()).filter(msg => {
      const msgTime = new Date(msg.createdTimestamp);
      return msgTime > since && msg.attachments.size > 0;
    });
    
    return { 
      success: true, 
      channel: { 
        id: channel.id, 
        name: channel.name || 'Unknown' 
      },
      messageCount: messages.size,
      filteredCount: filteredMessages.length,
      messages: filteredMessages.map(msg => ({
        id: msg.id,
        author: msg.author.username,
        timestamp: new Date(msg.createdTimestamp).toISOString(),
        hasAttachments: msg.attachments.size > 0,
        attachmentUrls: Array.from(msg.attachments.values()).map(a => a.url)
      }))
    };
  } catch (error) {
    return { error: `채널 메시지 가져오기 오류: ${error.message}` };
  }
}

module.exports = async function(req, res) {
  // 결과 객체 초기화
  const result = {
    success: false,
    timestamp: new Date().toISOString(),
    config: {
      hasDiscordToken: !!DISCORD_TOKEN,
      monitoredChannels: MONITORED_CHANNEL_IDS,
      hasWebhook: !!DISCORD_WEBHOOK_URL
    },
    logs: []
  };
  
  // 토큰 확인
  if (!DISCORD_TOKEN) {
    result.error = "Discord 토큰이 설정되지 않았습니다.";
    return res.status(400).json(result);
  }
  
  // 채널 ID 확인
  if (!MONITORED_CHANNEL_IDS || MONITORED_CHANNEL_IDS.length === 0) {
    result.error = "모니터링할 채널 ID가 설정되지 않았습니다.";
    return res.status(400).json(result);
  }
  
  // 웹훅 확인 및 테스트
  if (DISCORD_WEBHOOK_URL) {
    const webhookTest = await logToWebhook("디버그 API가 호출되었습니다. 웹훅 테스트 중...");
    result.webhookTest = webhookTest;
  }
  
  // Discord 클라이언트 초기화
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  let discordConnected = false;
  
  try {
    // Discord 로그인
    await client.login(DISCORD_TOKEN);
    discordConnected = true;
    result.discord = { connected: true };
    
    // 최근 검색 시간 설정 (30분 전)
    const lastSyncTime = new Date();
    lastSyncTime.setMinutes(lastSyncTime.getMinutes() - 30);
    
    // 각 모니터링 채널에서 메시지 가져오기
    for (const channelId of MONITORED_CHANNEL_IDS) {
      const channelResult = await fetchRecentMessages(client, channelId, lastSyncTime);
      result.logs.push({
        channelId,
        ...channelResult
      });
    }
    
    result.success = true;
  } catch (error) {
    result.error = `Discord 연결 오류: ${error.message}`;
    await logToWebhook(`❌ 디버그 API 오류: ${error.message}`);
  } finally {
    // Discord 클라이언트 정리
    if (discordConnected) {
      await client.destroy();
    }
  }
  
  // 결과 반환
  return res.status(result.success ? 200 : 500).json(result);
} 