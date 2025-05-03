/**
 * Discord 서버에서 이미지 인증 로그를 동기화하는 Cron API
 * 10분마다 실행되어 새로운 이미지 인증 로그를 가져옴
 */

import { Octokit } from '@octokit/rest';
import { createHash } from 'crypto';
import { Client, GatewayIntentBits } from 'discord.js';

// 환경 변수 설정
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const LOG_FILE_PATH = 'public/image_log.json';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// 모니터링할 Discord 채널 ID 목록
const MONITORED_CHANNEL_IDS = process.env.MONITORED_CHANNEL_IDS ? 
  process.env.MONITORED_CHANNEL_IDS.split(',') : 
  [];

/**
 * GitHub API 클라이언트 초기화
 */
const octokit = GITHUB_TOKEN ? new Octokit({
  auth: GITHUB_TOKEN
}) : null;

/**
 * 웹훅 로깅 함수
 */
async function logToWebhook(message) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
    console.log('Webhook URL이 설정되지 않았습니다:', message);
    return;
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🔄 Cron 동기화 로그',
          description: message,
          color: 0x00aaff,
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (error) {
    console.error('웹훅 로깅 오류:', error);
  }
}

/**
 * GitHub에서 로그 파일 가져오기
 */
async function getLogFileFromGitHub() {
  if (!octokit) {
    console.error('GitHub 토큰이 설정되지 않았습니다.');
    return { content: [], sha: null };
  }

  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH
    });

    const content = Buffer.from(response.data.content, 'base64').toString();
    return {
      content: JSON.parse(content),
      sha: response.data.sha
    };
  } catch (error) {
    if (error.status === 404) {
      console.log('로그 파일이 없습니다. 새로 생성합니다.');
      return { content: [], sha: null };
    }
    console.error('GitHub 로그 파일 가져오기 오류:', error);
    throw error;
  }
}

/**
 * GitHub에 로그 파일 업데이트
 */
async function updateLogFileOnGitHub(logData, sha) {
  if (!octokit) {
    console.error('GitHub 토큰이 설정되지 않았습니다.');
    return null;
  }

  try {
    const content = Buffer.from(JSON.stringify(logData, null, 2)).toString('base64');
    
    const params = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
      message: `이미지 로그 동기화 업데이트 (${new Date().toISOString()})`,
      content: content,
      committer: {
        name: 'Discord Bot Cron',
        email: 'discord-bot-cron@noreply.github.com'
      }
    };
    
    if (sha) {
      params.sha = sha;
    }
    
    const response = await octokit.repos.createOrUpdateFileContents(params);
    return response.data.content.sha;
  } catch (error) {
    console.error('GitHub 로그 파일 업데이트 오류:', error);
    throw error;
  }
}

/**
 * Discord 채널에서 최근 메시지 가져오기
 */
async function fetchRecentMessages(client, channelId, since) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.log(`채널 ID ${channelId}를 찾을 수 없습니다.`);
      return [];
    }
    
    console.log(`채널 '${channel.name || channelId}'에서 메시지 수집 중...`);
    
    const messages = await channel.messages.fetch({ limit: 100 });
    return Array.from(messages.values()).filter(msg => {
      const msgTime = new Date(msg.createdTimestamp);
      return msgTime > since && msg.attachments.size > 0;
    });
  } catch (error) {
    console.error(`채널 ID ${channelId} 메시지 가져오기 오류:`, error);
    return [];
  }
}

/**
 * 모든 모니터링 채널에서 새 메시지 수집
 */
async function collectNewMessages(client, since) {
  let allMessages = [];
  
  for (const channelId of MONITORED_CHANNEL_IDS) {
    const messages = await fetchRecentMessages(client, channelId, since);
    allMessages = allMessages.concat(messages);
  }
  
  return allMessages;
}

/**
 * 메시지를 로그 형식으로 변환
 */
function messageToLogEntry(message) {
  const serverId = message.guild ? message.guild.id : 'dm';
  const serverName = message.guild ? message.guild.name : 'Direct Message';
  
  // 첨부파일 중 이미지만 추출
  const imageAttachments = Array.from(message.attachments.values())
    .filter(attachment => attachment.contentType && attachment.contentType.startsWith('image/'));
  
  if (imageAttachments.length === 0) {
    return null;
  }
  
  const entries = [];
  
  for (const attachment of imageAttachments) {
    const timestamp = new Date(message.createdTimestamp);
    const utcTimestampStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
    
    // KST 타임스탬프 (UTC+9)
    const kstTimestamp = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000);
    const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').substr(0, 19);
    
    entries.push({
      nickname: message.author.username,
      timestamp: timestamp.toISOString(),
      timestampStr: utcTimestampStr,
      kstTimestampStr: kstTimestampStr,
      image_url: attachment.url,
      messageId: message.id,
      serverId,
      serverName,
      channelId: message.channel.id,
      channelName: message.channel.name || 'Unknown'
    });
  }
  
  return entries;
}

/**
 * 환경 변수 구성 확인
 */
function checkConfiguration() {
  const missingVars = [];
  
  if (!DISCORD_TOKEN) missingVars.push('DISCORD_TOKEN');
  if (!GITHUB_TOKEN) missingVars.push('GITHUB_TOKEN');
  if (!GITHUB_OWNER) missingVars.push('GITHUB_OWNER');
  if (!GITHUB_REPO) missingVars.push('GITHUB_REPO');
  if (!MONITORED_CHANNEL_IDS || MONITORED_CHANNEL_IDS.length === 0) missingVars.push('MONITORED_CHANNEL_IDS');

  return missingVars;
}

/**
 * API 핸들러: Cron 작업으로 실행됨
 */
export default async function handler(req, res) {
  // Vercel Cron 인증 확인 또는 테스트 목적의 GET 요청 허용
  if (req.headers['x-vercel-signature'] || req.method === 'GET') {
    console.log('Discord 로그 동기화 시작...');

    // 환경 변수 확인
    const missingConfig = checkConfiguration();
    if (missingConfig.length > 0) {
      const errorMessage = `필수 환경 변수가 설정되지 않았습니다: ${missingConfig.join(', ')}`;
      console.error(errorMessage);
      
      // GET 요청의 경우 설정 상태 반환
      if (req.method === 'GET') {
        return res.status(200).json({
          success: false,
          error: errorMessage,
          config: {
            hasDiscordToken: !!DISCORD_TOKEN,
            hasGithubToken: !!GITHUB_TOKEN,
            hasGithubOwner: !!GITHUB_OWNER,
            hasGithubRepo: !!GITHUB_REPO,
            monitoredChannels: MONITORED_CHANNEL_IDS,
            hasWebhook: !!DISCORD_WEBHOOK_URL && !DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')
          }
        });
      }
      
      return res.status(500).json({ success: false, error: errorMessage });
    }
    
    try {
      // GET 요청의 경우 직접 실행을 위한 테스트인지 확인
      const isTestRun = req.method === 'GET' && req.query.test === 'true';
      
      if (isTestRun) {
        return res.status(200).json({
          success: true,
          message: '설정 확인 완료. 모든 환경 변수가 올바르게 설정되었습니다.',
          config: {
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO, 
            monitoredChannels: MONITORED_CHANNEL_IDS,
            hasWebhook: !!DISCORD_WEBHOOK_URL
          }
        });
      }
      
      // 1. GitHub에서 현재 로그 가져오기
      const { content: logData, sha } = await getLogFileFromGitHub();
      
      // 2. 최근 검색 시간 계산 (30분전)
      const lastSyncTime = new Date();
      lastSyncTime.setMinutes(lastSyncTime.getMinutes() - 30);
      
      // 3. Discord 클라이언트 초기화
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });
      
      let newLogCount = 0;
      let discordConnected = false;
      
      try {
        // 4. Discord 로그인
        await client.login(DISCORD_TOKEN);
        discordConnected = true;
        
        // 5. 모든 모니터링 채널에서 새 메시지 가져오기
        const newMessages = await collectNewMessages(client, lastSyncTime);
        console.log(`새 메시지 ${newMessages.length}개 발견`);
        
        if (newMessages.length > 0) {
          // 6. 메시지 로그 변환
          const existingMessageIds = new Set(logData.map(entry => entry.messageId));
          
          for (const message of newMessages) {
            const logEntries = messageToLogEntry(message);
            if (!logEntries) continue;
            
            for (const entry of logEntries) {
              // 이미 있는 메시지 건너뛰기
              if (existingMessageIds.has(entry.messageId)) continue;
              
              logData.push(entry);
              newLogCount++;
            }
          }
          
          if (newLogCount > 0) {
            // 7. 날짜순 정렬 (최신순)
            logData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // 8. GitHub에 업데이트
            await updateLogFileOnGitHub(logData, sha);
            console.log(`${newLogCount}개의 새 로그 항목 추가됨`);
            
            // 9. 웹훅 로그 전송
            await logToWebhook(`✅ ${newLogCount}개의 새 이미지 인증이 동기화되었습니다.`);
          } else {
            console.log('새로운 로그 항목이 없습니다.');
            await logToWebhook(`✅ 새로운 이미지 인증이 없습니다. (스캔된 메시지: ${newMessages.length}개)`);
          }
        } else {
          await logToWebhook('✅ 새로운 메시지가 없습니다.');
        }
      } catch (error) {
        console.error('Discord 동기화 오류:', error);
        await logToWebhook(`❌ Discord 동기화 오류: ${error.message}`);
        throw error;
      } finally {
        // Discord 클라이언트 로그아웃
        if (discordConnected) {
          await client.destroy();
        }
      }
      
      // 응답 반환
      return res.status(200).json({ 
        success: true, 
        message: `Discord 로그 동기화 완료. ${newLogCount}개의 새 로그 추가됨.` 
      });
    } catch (error) {
      console.error('로그 동기화 오류:', error);
      
      // 오류 로그
      await logToWebhook(`❌ 로그 동기화 오류: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: `로그 동기화 오류: ${error.message}`
      });
    }
  } else {
    // 인증되지 않은 요청 거부
    return res.status(401).json({ error: '인증되지 않은 요청' });
  }
} 