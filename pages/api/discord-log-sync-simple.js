/**
 * 디스코드 로그 동기화 API (하루 한 번 실행)
 * 노트북이 꺼져있더라도 Discord API를 통해 로그를 수집하고,
 * 기존 로그 파일(public/image_log.json)과 통합합니다.
 */

// 환경 변수
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MONITORED_CHANNEL_IDS = process.env.MONITORED_CHANNEL_IDS ? 
  process.env.MONITORED_CHANNEL_IDS.split(',') : [];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'wnsgml7838';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'discord_bot';
const GITHUB_REPO = `${GITHUB_OWNER}/${GITHUB_REPO_NAME}`;
const LOG_FILE_PATH = 'data/auth_logs.json';
const PUBLIC_LOG_FILE_PATH = 'public/image_log.json';

/**
 * Discord 웹훅에 로그 메시지 전송
 */
async function logToWebhook(title, description, fields = [], color = 0x00ff00, isError = false) {
  if (!DISCORD_WEBHOOK_URL) return { success: false, error: '웹훅 URL이 설정되지 않았습니다' };
  
  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          description,
          color: isError ? 0xff0000 : color,
          fields,
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `웹훅 요청 실패: ${response.status} ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: `웹훅 전송 오류: ${error.message}` };
  }
}

/**
 * GitHub에서 기존 로그 파일 가져오기
 */
async function fetchExistingLogs(filePath) {
  if (!GITHUB_TOKEN) return { success: false, logs: [], error: 'GitHub 토큰이 설정되지 않았습니다' };
  
  try {
    console.log(`GitHub에서 파일 가져오기 시도: ${filePath}, 저장소: ${GITHUB_REPO}`);
    
    // 파일 내용 가져오기 (base64로 인코딩됨)
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.status === 404) {
      console.log(`GitHub에서 파일을 찾을 수 없음: ${filePath}. 빈 로그 배열로 시작합니다.`);
      // 파일이 없는 경우 빈 로그 배열 반환
      return { success: true, logs: [], sha: null };
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API 오류 (${response.status}): ${errorText}`);
      return { success: false, logs: [], error: `GitHub API 오류: ${response.status} ${errorText}` };
    }
    
    const data = await response.json();
    const content = Buffer.from(data.sha ? data.content : '', 'base64').toString('utf-8');
    
    try {
      const logs = content ? JSON.parse(content) : [];
      console.log(`파일에서 ${logs.length}개의 로그 항목을 성공적으로 가져왔습니다.`);
      return { success: true, logs, sha: data.sha };
    } catch (error) {
      console.error(`로그 JSON 파싱 오류: ${error.message}`);
      return { success: false, logs: [], error: `로그 파싱 오류: ${error.message}` };
    }
  } catch (error) {
    console.error(`GitHub API 요청 중 예외 발생: ${error.message}`);
    return { success: false, logs: [], error: `GitHub API 요청 오류: ${error.message}` };
  }
}

/**
 * GitHub에 업데이트된 로그 파일 저장
 */
async function saveLogsToGitHub(logs, filePath, existingSha) {
  if (!GITHUB_TOKEN) return { success: false, error: 'GitHub 토큰이 설정되지 않았습니다' };
  
  try {
    console.log(`GitHub에 파일 저장 시도: ${filePath}, 저장소: ${GITHUB_REPO}, SHA 존재: ${!!existingSha}`);
    
    const content = Buffer.from(JSON.stringify(logs, null, 2)).toString('base64');
    
    const body = {
      message: `로그 업데이트: ${new Date().toISOString()}`,
      content,
      ...(existingSha ? { sha: existingSha } : {})
    };
    
    // 디버깅을 위한 API URL 출력
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
    console.log(`GitHub API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub 저장 실패 (${response.status}): ${errorText}`);
      
      // 디버깅용 추가 정보
      if (response.status === 404) {
        console.error('404 오류 발생: 저장소 또는 파일 경로를 확인하세요.');
        console.error(`소유자: ${GITHUB_OWNER}, 저장소명: ${GITHUB_REPO_NAME}`);
        console.error(`전체 저장소 경로: ${GITHUB_REPO}`);
        console.error(`파일 경로: ${filePath}`);
      } else if (response.status === 401) {
        console.error('401 오류 발생: GitHub 토큰 권한을 확인하세요.');
      }
      
      return { success: false, error: `GitHub 저장 실패: ${response.status} ${errorText}` };
    }
    
    console.log(`파일을 성공적으로 GitHub에 저장했습니다: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error(`GitHub 저장 중 예외 발생: ${error.message}`);
    return { success: false, error: `GitHub 저장 오류: ${error.message}` };
  }
}

/**
 * Discord API를 통해 특정 채널의 메시지 가져오기
 * limit: 가져올 메시지 수 (최대 100)
 * after: 특정 메시지 ID 이후의 메시지만 가져오기
 * before: 특정 메시지 ID 이전의 메시지만 가져오기
 */
async function fetchChannelMessages(channelId, limit = 100, after = null) {
  if (!DISCORD_TOKEN) return { success: false, messages: [], error: 'Discord 토큰이 설정되지 않았습니다' };
  
  try {
    let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`;
    if (after) url += `&after=${after}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, messages: [], error: `Discord API 오류: ${response.status} ${error}` };
    }
    
    const messages = await response.json();
    return { success: true, messages };
  } catch (error) {
    return { success: false, messages: [], error: `Discord API 요청 오류: ${error.message}` };
  }
}

/**
 * 메시지 내용이 인증 이미지를 포함하는지 확인
 */
function isAuthImageMessage(message) {
  // 이미지 첨부 파일이 있는지 확인
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    // 이미지 형식 체크
    return attachment.content_type && attachment.content_type.startsWith('image/');
  }
  
  // 이미지 URL이 포함된 메시지 내용 확인
  const imageUrlPattern = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i;
  return imageUrlPattern.test(message.content);
}

/**
 * 메시지에서 인증 이미지 URL 추출
 */
function extractImageUrl(message) {
  // 첨부 파일에서 이미지 URL 가져오기
  if (message.attachments && message.attachments.length > 0) {
    return message.attachments[0].url || message.attachments[0].proxy_url;
  }
  
  // 메시지 내용에서 이미지 URL 추출
  const imageUrlPattern = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i;
  const match = message.content.match(imageUrlPattern);
  return match ? match[1] : null;
}

/**
 * 메시지 내용에서 인증 로그 정보 추출
 */
function extractAuthLogInfo(message) {
  // 기존 로그 형식 유지
  const logInfo = {
    id: message.id,
    timestamp: message.timestamp,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      discriminator: message.author.discriminator
    },
    channelId: message.channel_id
  };
  
  // 메시지가 봇에 의해 보내졌는지 확인
  if (message.author.bot) {
    logInfo.isBot = true;
    
    // 인증 메시지 패턴 확인 (예: "홍길동님이 인증에 성공했습니다")
    const authSuccessPattern = /(.+)님이 인증에 성공했습니다/;
    const authFailPattern = /(.+)님의 인증이 실패했습니다/;
    
    const successMatch = message.content.match(authSuccessPattern);
    const failMatch = message.content.match(authFailPattern);
    
    if (successMatch) {
      logInfo.type = 'auth_success';
      logInfo.username = successMatch[1];
    } else if (failMatch) {
      logInfo.type = 'auth_fail';
      logInfo.username = failMatch[1];
    } else {
      logInfo.type = 'bot_message';
    }
  } else {
    // 일반 사용자 메시지
    logInfo.type = 'user_message';
  }
  
  return logInfo;
}

/**
 * public/image_log.json 형식에 맞는 로그 항목 생성
 */
function createImageLogEntry(message) {
  // 한국 시간대(KST)로 변환 (UTC+9)
  const timestamp = new Date(message.timestamp);
  const kstTimestamp = new Date(timestamp.getTime() + (9 * 60 * 60 * 1000));
  
  // ISO 형식의 타임스탬프 문자열
  const timestampStr = timestamp.toISOString().replace('T', ' ').slice(0, 19);
  
  // KST 형식의 타임스탬프 문자열
  const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').slice(0, 19);
  
  // 이미지 URL 추출
  const image_url = extractImageUrl(message);
  
  // 닉네임 추출 (일반적으로 디스코드 사용자명)
  const nickname = message.author.username;
  
  return {
    nickname,
    timestamp: timestamp.toISOString(),
    timestampStr,
    kstTimestampStr,
    image_url,
    messageId: message.id
  };
}

/**
 * 메시지가 이미 처리되었는지 중복 체크 (ID와 타임스탬프 모두 비교)
 */
function isDuplicateMessage(message, existingLogs) {
  if (!existingLogs || existingLogs.length === 0) return false;
  
  const messageId = message.id;
  const timestamp = message.timestamp;
  
  return existingLogs.some(log => 
    (log.id === messageId || log.messageId === messageId) && 
    (log.timestamp === timestamp)
  );
}

export default async function handler(req, res) {
  // 결과 객체 초기화
  const result = {
    success: false,
    date: new Date().toISOString(),
    logs: {
      collected: 0,
      newEntries: 0,
      channels: {},
      imageLogsAdded: 0
    },
    errors: [],
    debug: {
      githubRepo: GITHUB_REPO,
      authLogPath: LOG_FILE_PATH,
      imageLogPath: PUBLIC_LOG_FILE_PATH
    }
  };
  
  try {
    // 현재 날짜 정보 추출
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[now.getDay()];
    
    // 필수 환경변수 확인
    if (!DISCORD_TOKEN) {
      result.errors.push('Discord 토큰이 설정되지 않았습니다');
      await logToWebhook(
        '⚠️ 로그 동기화 실패', 
        `Discord 토큰이 설정되지 않아 동기화를 진행할 수 없습니다.`, 
        [], 0, true
      );
      return res.status(400).json(result);
    }
    
    if (MONITORED_CHANNEL_IDS.length === 0) {
      result.errors.push('모니터링할 채널 ID가 설정되지 않았습니다');
      await logToWebhook(
        '⚠️ 로그 동기화 실패', 
        `모니터링할 채널 ID가 설정되지 않아 동기화를 진행할 수 없습니다.`, 
        [], 0, true
      );
      return res.status(400).json(result);
    }
    
    if (!GITHUB_TOKEN) {
      result.errors.push('GitHub 토큰이 설정되지 않았습니다. 로그는 수집되지만 저장되지 않을 것입니다.');
      console.error('GitHub 토큰이 설정되지 않았습니다. 환경 변수 GITHUB_TOKEN을 확인하세요.');
      await logToWebhook(
        '⚠️ GitHub 연결 문제', 
        `GitHub 토큰이 설정되지 않아 로그를 저장할 수 없습니다. 환경 변수를 확인하세요.`, 
        [], 0, true
      );
      // 토큰이 없어도 계속 진행 (저장만 실패)
    }
    
    // 기존 로그 파일들 가져오기
    const { success: fetchAuthSuccess, logs: existingAuthLogs, sha: authSha, error: fetchAuthError } = 
      await fetchExistingLogs(LOG_FILE_PATH);
    
    const { success: fetchImageSuccess, logs: existingImageLogs, sha: imageSha, error: fetchImageError } = 
      await fetchExistingLogs(PUBLIC_LOG_FILE_PATH);
    
    if (!fetchAuthSuccess) {
      result.errors.push(`인증 로그 가져오기 실패: ${fetchAuthError}`);
      await logToWebhook(
        '⚠️ 로그 동기화 오류', 
        `GitHub에서 인증 로그를 가져오는 중 오류가 발생했습니다: ${fetchAuthError}`, 
        [], 0, true
      );
      // 오류가 있어도 계속 진행
    }
    
    if (!fetchImageSuccess) {
      result.errors.push(`이미지 로그 가져오기 실패: ${fetchImageError}`);
      await logToWebhook(
        '⚠️ 로그 동기화 오류', 
        `GitHub에서 이미지 로그를 가져오는 중 오류가 발생했습니다: ${fetchImageError}`, 
        [], 0, true
      );
      // 오류가 있어도 계속 진행
    }
    
    // 24시간 이전 타임스탬프 계산 (밀리초)
    const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);
    const newAuthLogs = [...(existingAuthLogs || [])];
    const newImageLogs = [...(existingImageLogs || [])];
    let totalNewLogs = 0;
    let totalNewImageLogs = 0;
    
    // 각 모니터링 채널에서 메시지 가져오기
    for (const channelId of MONITORED_CHANNEL_IDS) {
      result.logs.channels[channelId] = { processed: 0, new: 0, newImages: 0, errors: [] };
      
      try {
        // 가장 최근에 처리된 메시지 ID 찾기 (채널별)
        let lastMessageId = null;
        if (existingAuthLogs && existingAuthLogs.length > 0) {
          const channelLogs = existingAuthLogs.filter(log => log.channelId === channelId);
          if (channelLogs.length > 0) {
            // ID 기준 정렬 (내림차순)
            channelLogs.sort((a, b) => b.id.localeCompare(a.id));
            lastMessageId = channelLogs[0].id;
          }
        }
        
        // 메시지 가져오기 (최근 100개, 또는 마지막으로 처리된 메시지 이후)
        const { success: msgSuccess, messages, error: msgError } = 
          await fetchChannelMessages(channelId, 100, lastMessageId);
        
        if (!msgSuccess) {
          result.logs.channels[channelId].errors.push(msgError);
          result.errors.push(`채널 ${channelId} 메시지 가져오기 실패: ${msgError}`);
          continue;
        }
        
        // 가져온 메시지가 없으면 다음 채널로
        if (messages.length === 0) {
          result.logs.channels[channelId].info = "새로운 메시지 없음";
          continue;
        }
        
        // 메시지 처리 및 로그 추출
        result.logs.channels[channelId].processed = messages.length;
        
        for (const message of messages) {
          // 24시간 이내의 메시지만 처리
          const messageTime = new Date(message.timestamp).getTime();
          if (messageTime < oneDayAgo) continue;
          
          // 1. 인증 로그용 정보 추출 및 저장
          const logInfo = extractAuthLogInfo(message);
          
          // 강화된 중복 체크: 메시지 ID와 타임스탬프 모두 비교
          if (!isDuplicateMessage(message, existingAuthLogs)) {
            newAuthLogs.push(logInfo);
            result.logs.channels[channelId].new++;
            totalNewLogs++;
          }
          
          // 2. 이미지 로그용 정보 추출 및 저장 (이미지가 있는 메시지만)
          if (isAuthImageMessage(message)) {
            // 강화된 중복 체크: 메시지 ID와 타임스탬프 모두 비교
            if (!isDuplicateMessage(message, existingImageLogs)) {
              const imageLogEntry = createImageLogEntry(message);
              if (imageLogEntry.image_url) {
                newImageLogs.push(imageLogEntry);
                result.logs.channels[channelId].newImages++;
                totalNewImageLogs++;
              }
            }
          }
        }
      } catch (channelError) {
        result.logs.channels[channelId].errors.push(channelError.message);
        result.errors.push(`채널 ${channelId} 처리 중 오류: ${channelError.message}`);
      }
    }
    
    // 로그 정렬 (시간 기준 내림차순)
    newAuthLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    newImageLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // 결과 업데이트
    result.logs.collected = newAuthLogs.length;
    result.logs.newEntries = totalNewLogs;
    result.logs.imageLogsAdded = totalNewImageLogs;
    
    // 새 로그가 있는 경우만 저장
    let saveSuccess = true;
    
    if (totalNewLogs > 0) {
      const { success: authSaveSuccess, error: authSaveError } = 
        await saveLogsToGitHub(newAuthLogs, LOG_FILE_PATH, authSha);
      
      if (!authSaveSuccess) {
        saveSuccess = false;
        result.errors.push(`인증 로그 저장 실패: ${authSaveError}`);
        await logToWebhook(
          '⚠️ 로그 저장 오류', 
          `GitHub에 인증 로그를 저장하는 중 오류가 발생했습니다: ${authSaveError}`, 
          [], 0, true
        );
      }
    }
    
    if (totalNewImageLogs > 0) {
      const { success: imageSaveSuccess, error: imageSaveError } = 
        await saveLogsToGitHub(newImageLogs, PUBLIC_LOG_FILE_PATH, imageSha);
      
      if (!imageSaveSuccess) {
        saveSuccess = false;
        result.errors.push(`이미지 로그 저장 실패: ${imageSaveError}`);
        await logToWebhook(
          '⚠️ 로그 저장 오류', 
          `GitHub에 이미지 로그를 저장하는 중 오류가 발생했습니다: ${imageSaveError}`, 
          [], 0, true
        );
      }
    }
    
    // 최종 성공 여부 결정
    result.success = saveSuccess || (totalNewLogs === 0 && totalNewImageLogs === 0);
    if (totalNewLogs === 0 && totalNewImageLogs === 0) {
      result.info = "새로운 로그가 없습니다";
    }
    
    // 결과 요약을 Discord 웹훅으로 전송
    const fields = [
      {
        name: '모니터링 채널',
        value: MONITORED_CHANNEL_IDS.join(', '),
        inline: false
      },
      {
        name: '수집된 총 인증 로그',
        value: `${newAuthLogs.length}개`,
        inline: true
      },
      {
        name: '새로 추가된 인증 로그',
        value: `${totalNewLogs}개`,
        inline: true
      },
      {
        name: '새로 추가된 이미지 로그',
        value: `${totalNewImageLogs}개`,
        inline: true
      },
      {
        name: 'GitHub 저장소 정보',
        value: `저장소: ${GITHUB_REPO}\n인증 로그 경로: ${LOG_FILE_PATH}\n이미지 로그 경로: ${PUBLIC_LOG_FILE_PATH}`,
        inline: false
      }
    ];
    
    // 채널별 정보 추가
    for (const channelId of MONITORED_CHANNEL_IDS) {
      const channelInfo = result.logs.channels[channelId];
      fields.push({
        name: `채널 ${channelId}`,
        value: `처리: ${channelInfo.processed}개, 신규 인증: ${channelInfo.new}개, 신규 이미지: ${channelInfo.newImages}개${
          channelInfo.errors.length > 0 ? `\n오류: ${channelInfo.errors.length}개` : ''
        }`,
        inline: true
      });
    }
    
    // 오류가 있으면 필드에 추가
    if (result.errors.length > 0) {
      fields.push({
        name: '오류',
        value: result.errors.slice(0, 3).join('\n') + 
          (result.errors.length > 3 ? `\n...외 ${result.errors.length - 3}개` : ''),
        inline: false
      });
    }
    
    await logToWebhook(
      '📊 디스코드 로그 동기화 결과', 
      `${dateStr} (${dayOfWeek}) 디스코드 로그 동기화가 ${result.success ? '완료' : '일부 실패'}되었습니다.\n실행 시간: ${timeStr}`,
      fields,
      result.success ? 0x00ff00 : 0xffcc00
    );
    
    return res.status(200).json(result);
  } catch (error) {
    result.errors.push(`API 오류: ${error.message}`);
    
    await logToWebhook(
      '❌ 로그 동기화 치명적 오류', 
      `로그 동기화 중 예기치 않은 오류가 발생했습니다: ${error.message}`,
      [],
      0,
      true
    );
    
    return res.status(500).json(result);
  }
} 