const discord = require('discord.js');
const { Octokit } = require('@octokit/rest');
const path = require('path');
const { recommendBaekjoonProblems } = require('./discord_bot_problem_recommender');
const discordLogger = require('../utils/discordLogger');

// 환경 변수에서 토큰을 읽을 경우를 위한 dotenv 설정
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const LOG_FILE_PATH = 'public/image_log.json';

// GitHub API 클라이언트 초기화
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// 디스코드 인텐츠 설정
const intents = new discord.IntentsBitField();
intents.add(
  discord.IntentsBitField.Flags.Guilds,
  discord.IntentsBitField.Flags.GuildMessages,
  discord.IntentsBitField.Flags.MessageContent,
  discord.IntentsBitField.Flags.DirectMessages, // DM 메시지 수신 권한 추가
  discord.IntentsBitField.Flags.DirectMessageReactions, // DM 반응 권한 추가
  discord.IntentsBitField.Flags.DirectMessageTyping // DM 타이핑 권한 추가
);

const client = new discord.Client({ intents });

// 로그 데이터와 파일 SHA 저장용 변수
let logData = [];
let fileSha = null;

// GitHub에서 현재 로그 파일 데이터와 SHA 가져오기
async function getLogFileFromGitHub() {
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH
    });

    fileSha = response.data.sha;
    
    // base64로 인코딩된 내용 디코딩
    const content = Buffer.from(response.data.content, 'base64').toString();
    logData = JSON.parse(content);
    
    console.log(`로그 파일 불러옴: ${logData.length}개 항목`);
    return logData;
  } catch (error) {
    // 파일이 없는 경우 404 에러 발생
    if (error.status === 404) {
      console.log('로그 파일이 존재하지 않아 새로 생성합니다.');
      logData = [];
      return logData;
    }
    console.error('로그 파일 불러오기 오류:', error);
    throw error;
  }
}

// GitHub에 로그 파일 업데이트
async function updateLogFileOnGitHub() {
  try {
    const content = Buffer.from(JSON.stringify(logData, null, 2)).toString('base64');
    
    const params = {
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: LOG_FILE_PATH,
      message: `이미지 로그 업데이트 (${new Date().toISOString()})`,
      content: content,
      committer: {
        name: 'Discord Bot',
        email: 'discord-bot@noreply.github.com'
      }
    };
    
    // 파일이 이미 존재하는 경우 SHA 추가
    if (fileSha) {
      params.sha = fileSha;
    }
    
    const response = await octokit.repos.createOrUpdateFileContents(params);
    
    // 새 SHA 저장
    fileSha = response.data.content.sha;
    console.log('로그 파일이 GitHub에 업데이트되었습니다.');
    
    return response;
  } catch (error) {
    console.error('GitHub 로그 파일 업데이트 오류:', error);
    throw error;
  }
}

// 이전 메시지 데이터 가져오기
async function fetchHistoricalData(targetChannelId, resetData = false) {
  console.log('이전 메시지 데이터 수집을 시작합니다...');
  try {
    // 로그 데이터가 아직 로드되지 않았다면 로드
    if (logData.length === 0 && !fileSha) {
      await getLogFileFromGitHub();
    }
    
    // 기존 데이터 초기화 옵션이 켜져 있으면 로그 데이터 비우기
    if (resetData) {
      console.log('기존 로그 데이터를 초기화합니다. Reset 옵션:', resetData);
      logData = [];
      // existingMessageIds를 빈 상태로 시작하기 위해 빈 Set으로 초기화
      const existingMessageIds = new Set();
      console.log('로그 데이터 초기화 완료. 현재 항목 수:', logData.length);
    } else {
      console.log('기존 로그 데이터를 유지합니다. 현재 항목 수:', logData.length);
    }
    
    // 대상 채널 가져오기
    const channel = await client.channels.fetch(targetChannelId);
    if (!channel) {
      console.error(`채널 ID ${targetChannelId}를 찾을 수 없습니다.`);
      return;
    }
    
    // 이미 수집된 메시지 ID 목록 생성 (중복 방지)
    // resetData가 true일 경우 빈 Set으로 시작
    const existingMessageIds = resetData ? new Set() : new Set(logData.map(item => item.messageId).filter(Boolean));
    console.log(`기존 메시지 ID 수: ${existingMessageIds.size}`);
    
    let addedCount = 0;
    
    // 이전 메시지를 가져오기 위한 기준점
    let lastMessageId = null;
    let hasMoreMessages = true;
    
    // 메시지를 수집할 최대 횟수 설정 (너무 많은 요청 방지)
    const MAX_FETCH_ITERATIONS = 50;
    let fetchCount = 0;
    
    while (hasMoreMessages && fetchCount < MAX_FETCH_ITERATIONS) {
      // 메시지 가져오기 (한 번에 최대 100개)
      const options = { limit: 100 };
      if (lastMessageId) {
        options.before = lastMessageId;
      }
      
      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) {
        hasMoreMessages = false;
        break;
      }
      
      // 마지막 메시지 ID 업데이트
      lastMessageId = messages.last().id;
      fetchCount++;
      
      // 이미지가 있는 메시지만 필터링
      for (const [messageId, message] of messages) {
        // 이미 처리된 메시지 건너뛰기
        if (existingMessageIds.has(messageId)) continue;
        
        if (message.attachments.size > 0) {
          for (const [, attachment] of message.attachments) {
            if (attachment.contentType && attachment.contentType.startsWith("image/")) {
              const nickname = message.author.username;
              const timestamp = message.createdAt;
              const timestampStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
              
              // KST 타임스탬프 (UTC+9)
              const kstTimestamp = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000);
              const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').substr(0, 19);
              
              const image_url = attachment.url;
              
              // 로그 데이터 추가
              const newLog = {
                nickname,
                timestamp: timestamp.toISOString(),
                timestampStr,
                kstTimestampStr,  // KST 시간 추가
                image_url,
                messageId // 중복 방지를 위해 메시지 ID 저장
              };
              
              logData.push(newLog);
              addedCount++;
              
              console.log(`이전 이미지 데이터 추가: ${nickname}, UTC: ${timestampStr}, KST: ${kstTimestampStr}`);
            }
          }
        }
      }
      
      console.log(`메시지 수집 진행 중... 현재 ${addedCount}개 추가됨`);
    }
    
    if (addedCount > 0) {
      // 날짜를 기준으로 내림차순 정렬 (최신순)
      logData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // GitHub에 업데이트
      await updateLogFileOnGitHub();
      console.log(`이전 데이터 수집 완료: 총 ${addedCount}개의 이미지 데이터가 추가되었습니다.`);
    } else {
      console.log('추가할 이전 이미지 데이터가 없습니다.');
    }
  } catch (error) {
    console.error('이전 데이터 수집 오류:', error);
  }
}

// 로깅 데이터를 처리하는 함수
async function serverLog(type, options) {
  try {
    switch(type) {
      case 'command':
        await discordLogger.logCommand(options);
        break;
      case 'message':
        await discordLogger.logMessage(options);
        break;
      case 'join':
        await discordLogger.logJoin(options);
        break;
      case 'leave':
        await discordLogger.logLeave(options);
        break;
      case 'activity':
        await discordLogger.logActivity(options);
        break;
      case 'error':
        await discordLogger.logError(options);
        break;
      default:
        await discordLogger.logToDiscord('info', options.serverId, options.serverName, options.userId, options.userName, options.data);
    }
  } catch (error) {
    console.error(`로깅 중 오류 발생 (${type}):`, error);
  }
}

// Discord 봇 이벤트 핸들러 설정
client.on('ready', () => {
  console.log(`봇이 성공적으로 로그인되었습니다: ${client.user.tag}`);
  
  // 봇 시작 로깅
  serverLog('activity', {
    serverId: 'global',
    serverName: 'Global',
    activityType: 'bot_start',
    details: {
      botName: client.user.tag,
      botId: client.user.id,
      serverCount: client.guilds.cache.size,
      totalUsers: client.users.cache.size
    }
  });
  
  // 봇이 있는 모든 서버 정보 로깅
  client.guilds.cache.forEach(guild => {
    serverLog('activity', {
      serverId: guild.id,
      serverName: guild.name,
      activityType: 'bot_server_info',
      details: {
        memberCount: guild.memberCount,
        owner: guild.ownerId,
        channels: guild.channels.cache.size,
        createdAt: guild.createdAt.toISOString()
      }
    });
  });
  
  // 봇 시작 시 로그 파일 불러오기
  getLogFileFromGitHub().catch(console.error);
});

// 서버 참가 이벤트
client.on('guildCreate', guild => {
  console.log(`새로운 서버에 추가됨: ${guild.name} (id: ${guild.id})`);
  
  serverLog('join', {
    serverId: guild.id,
    serverName: guild.name,
    userId: client.user.id,
    userName: client.user.tag,
    joinedAt: new Date().toISOString()
  });
});

// 서버 퇴장 이벤트
client.on('guildDelete', guild => {
  console.log(`서버에서 제거됨: ${guild.name} (id: ${guild.id})`);
  
  serverLog('leave', {
    serverId: guild.id,
    serverName: guild.name,
    userId: client.user.id,
    userName: client.user.tag,
    leftAt: new Date().toISOString()
  });
});

// 메시지 이벤트
client.on('messageCreate', async message => {
  // 봇 메시지 무시
  if (message.author.bot) return;
  
  // 서버 및 사용자 정보
  const serverId = message.guild ? message.guild.id : 'dm';
  const serverName = message.guild ? message.guild.name : 'Direct Message';
  const userId = message.author.id;
  const userName = message.author.tag;
  
  // 명령어 처리
  if (message.content.startsWith('!') || message.content.startsWith('/')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // 명령어 실행 로깅
    serverLog('command', {
      serverId,
      serverName,
      userId,
      userName,
      command,
      args,
      channelId: message.channel.id,
      channelName: message.channel.name || 'DM'
    });
    
    // 백준 문제 추천 명령어 처리
    if (command === '백준추천' || command === '문제추천') {
      console.log(`백준 추천 명령어 감지: ${message.content}`);
      
      // 명령어 실행 로깅
      serverLog('command', {
        serverId,
        serverName,
        userId,
        userName,
        command: '백준추천',
        args,
        channelId: message.channel.id,
        channelName: message.channel.name || 'DM'
      });
      
      // 인자 확인
      if (!args[0]) {
        await message.reply('백준 아이디를 입력해주세요. 예: !백준추천 joonhee7838');
        return;
      }
      
      // 추천 모드 확인
      const handle = args[0];
      const mode = args[1] || 'personalized';
      console.log(`백준 추천 모드: ${mode}`);
      
      // 사용자에게 로딩 메시지 표시
      const loadingMessage = await message.reply('백준 문제를 추천하는 중입니다... (약 10-20초 소요)');
      
      try {
        // 백준 문제 추천 처리
        console.log('백준 추천 함수 호출 중...');
        const result = await recommendBaekjoonProblems(handle, mode);
        console.log('백준 추천 완료, 결과 전송 중...');
        
        // 로딩 메시지 제거
        await loadingMessage.delete();
        
        // 추천 결과 전송
        await message.reply({
          content: `${message.author}님, **${handle}**님의 백준 추천 문제입니다:`,
          embeds: [
            {
              title: '백준 문제 추천 결과',
              description: result,
              color: 0x0099ff
            }
          ]
        });
        
        // 추천 결과 로깅
        serverLog('activity', {
          serverId,
          serverName,
          userId,
          userName,
          activityType: 'baekjoon_recommend',
          details: {
            handle,
            mode,
            success: true
          }
        });
      } catch (error) {
        console.error('백준 문제 추천 오류:', error);
        
        // 로딩 메시지 제거
        await loadingMessage.delete();
        
        // 오류 메시지 전송
        await message.reply(`문제 추천 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
        
        // 오류 로깅
        serverLog('error', {
          serverId,
          serverName,
          userId,
          userName,
          error,
          context: {
            command: '백준추천',
            handle,
            mode
          }
        });
      }
    }
  }
  
  // 이미지 첨부 메시지 처리
  if (message.attachments.size > 0) {
    let hasImage = false;
    message.attachments.forEach(attachment => {
      if (attachment.contentType && attachment.contentType.startsWith("image/")) {
        hasImage = true;
      }
    });
    
    if (hasImage) {
      // 이미지 제출 로깅
      serverLog('activity', {
        serverId,
        serverName,
        userId,
        userName,
        activityType: 'image_submission',
        details: {
          channelId: message.channel.id,
          channelName: message.channel.name || 'DM',
          messageId: message.id,
          attachmentCount: message.attachments.size
        }
      });
      
      // 이미지 처리 및 로깅
      processImageAttachments(message);
    }
  }
});

// 이미지 첨부 처리 함수
async function processImageAttachments(message) {
  try {
    // 서버 및 사용자 정보
    const serverId = message.guild ? message.guild.id : 'dm';
    const serverName = message.guild ? message.guild.name : 'Direct Message';
    
    // DM의 경우 처리하지 않음
    if (!message.guild) {
      message.reply('DM에서는 이미지 저장 기능을 사용할 수 없습니다. 서버 채팅에서 이미지를 공유해주세요.');
      return;
    }
    
    for (const [, attachment] of message.attachments) {
      if (attachment.contentType && attachment.contentType.startsWith("image/")) {
        const nickname = message.author.username;
        const timestamp = new Date();
        
        // UTC 타임스탬프
        const utcTimestampStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
        
        // KST 타임스탬프 (UTC+9)
        const kstTimestamp = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000);
        const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').substr(0, 19);
        
        const image_url = attachment.url;
        
        // 터미널 출력
        console.log("👤 닉네임:", nickname);
        console.log("🕒 전송 시간 (UTC):", utcTimestampStr);
        console.log("🕒 전송 시간 (KST):", kstTimestampStr);
        console.log("🖼️ 이미지 URL:", image_url);
        console.log("-".repeat(50));
        
        try {
          // 로그 데이터 추가
          const newLog = {
            nickname,
            timestamp: timestamp.toISOString(),
            timestampStr: utcTimestampStr, 
            kstTimestampStr: kstTimestampStr,  // KST 시간 추가
            image_url,
            messageId: message.id, // 메시지 ID 추가
            serverId,  // 서버 ID 추가
            serverName // 서버 이름 추가
          };
          
          // 로그 데이터가 아직 로드되지 않았다면 로드
          if (logData.length === 0 && !fileSha) {
            await getLogFileFromGitHub();
          }
          
          // 로그 데이터에 새 항목 추가
          logData.push(newLog);
          
          // GitHub에 업데이트
          await updateLogFileOnGitHub();
          
          console.log('인증 로그가 GitHub에 저장되었습니다.');
        } catch (error) {
          console.error('로그 저장 오류:', error);
          
          // 로그 저장 오류 기록
          serverLog('error', {
            serverId,
            serverName,
            userId: message.author.id,
            userName: message.author.tag,
            error,
            context: {
              activity: 'save_image_log',
              channelId: message.channel.id,
              messageId: message.id
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('이미지 처리 중 오류 발생:', error);
    
    // 이미지 처리 오류 기록
    serverLog('error', {
      serverId: message.guild ? message.guild.id : 'dm',
      serverName: message.guild ? message.guild.name : 'Direct Message',
      userId: message.author.id,
      userName: message.author.tag,
      error,
      context: {
        activity: 'process_image',
        channelId: message.channel.id,
        messageId: message.id
      }
    });
  }
}

// Discord 봇 시작 함수
async function startBot() {
  try {
    // GitHub에서 로그 데이터 가져오기
    await getLogFileFromGitHub();
    
    // Discord에 로그인
    await client.login(TOKEN);
    console.log('봇이 시작되었습니다.');
    
    return client;
  } catch (error) {
    console.error('봇 시작 중 오류 발생:', error);
    
    // 오류 로깅
    serverLog('error', {
      serverId: 'global',
      serverName: 'Global',
      error,
      context: {
        activity: 'bot_start'
      }
    });
    
    throw error;
  }
}

// 이전 데이터 수집 명령어를 포함한 bot-start.js 파일 생성
async function startBotWithHistoricalData(channelId, resetData = false) {
  try {
    console.log(`데이터 초기화 모드: ${resetData ? '활성화' : '비활성화'}`);
    await startBot();
    
    // 봇이 로그인된 후 이전 데이터 수집
    client.once('ready', async () => {
      if (channelId) {
        console.log(`채널 ID ${channelId}에서 이전 데이터 수집을 시작합니다...`);
        await fetchHistoricalData(channelId, resetData);
      } else {
        console.log('이전 데이터 수집을 건너뜁니다. 채널 ID가 지정되지 않았습니다.');
      }
    });
  } catch (error) {
    console.error('봇 시작 및 이전 데이터 수집 오류:', error);
  }
}

// Discord 봇 시작 함수를 export
module.exports = {
  startBot,
  startBotWithHistoricalData,
  client
}; 