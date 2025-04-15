const discord = require('discord.js');
const { Octokit } = require('@octokit/rest');
const path = require('path');

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
  discord.IntentsBitField.Flags.MessageContent
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
              const image_url = attachment.url;
              
              // 로그 데이터 추가
              const newLog = {
                nickname,
                timestamp: timestamp.toISOString(),
                timestampStr,
                image_url,
                messageId // 중복 방지를 위해 메시지 ID 저장
              };
              
              logData.push(newLog);
              addedCount++;
              
              console.log(`이전 이미지 데이터 추가: ${nickname}, ${timestampStr}`);
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

client.once('ready', () => {
  console.log(`🤖 봇 로그인 성공: ${client.user.tag}`);
  
  // 봇 시작 시 로그 파일 불러오기
  getLogFileFromGitHub().catch(console.error);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.attachments.size > 0) {
    for (const [, attachment] of message.attachments) {
      if (attachment.contentType && attachment.contentType.startsWith("image/")) {
        const nickname = message.author.username;
        const timestamp = new Date();
        const timestampStr = timestamp.toISOString().replace('T', ' ').substr(0, 19);
        const image_url = attachment.url;

        // 터미널 출력
        console.log("👤 닉네임:", nickname);
        console.log("🕒 전송 시간:", timestampStr);
        console.log("🖼️ 이미지 URL:", image_url);
        console.log("-".repeat(50));

        try {
          // 로그 데이터 추가
          const newLog = {
            nickname,
            timestamp: timestamp.toISOString(),
            timestampStr, 
            image_url,
            messageId: message.id // 메시지 ID 추가
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
        }
      }
    }
  }
});

// 봇 시작 함수
async function startBot() {
  try {
    // GitHub 토큰 확인
    if (!GITHUB_TOKEN) {
      console.error('GitHub 토큰이 없습니다. .env 파일에 GITHUB_TOKEN을 설정해주세요.');
      return;
    }
    
    // GitHub 저장소 정보 확인
    if (!GITHUB_OWNER || !GITHUB_REPO) {
      console.error('GitHub 저장소 정보가 없습니다. .env 파일에 GITHUB_OWNER와 GITHUB_REPO를 설정해주세요.');
      return;
    }
    
    // 로그 파일 불러오기
    await getLogFileFromGitHub();
    
    // 디스코드 봇 로그인
    await client.login(TOKEN);
  } catch (error) {
    console.error('봇 시작 오류:', error);
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
module.exports = { startBot, fetchHistoricalData, startBotWithHistoricalData }; 