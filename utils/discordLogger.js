/**
 * utils/discordLogger.js
 * 여러 디스코드 서버에서 활동 로그를 수집하는 로깅 유틸리티
 */

// 환경변수에서 Discord Webhook URL을 가져옴
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * 디스코드 Webhook으로 로그를 전송하는 함수
 * @param {string} eventType - 이벤트 유형 (예: 'command', 'join', 'message', 'reaction')
 * @param {string} serverId - 디스코드 서버 ID
 * @param {string} serverName - 디스코드 서버 이름
 * @param {string} userId - 사용자 ID (옵션)
 * @param {string} userName - 사용자 이름 (옵션)
 * @param {Object} data - 추가 데이터 (옵션)
 * @returns {Promise<Object>} - 결과 객체
 */
async function logToDiscord(eventType, serverId, serverName, userId = null, userName = null, data = {}) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
    console.warn('Discord Webhook URL이 설정되지 않았습니다.');
    return { success: false, error: 'Webhook URL 미설정' };
  }

  try {
    // 현재 시간
    const timestamp = new Date().toISOString();
    
    // 이벤트 유형에 따른 색상 설정
    const colorMap = {
      command: 0x5865F2,    // 블루베리 (디스코드 브랜드 색상)
      join: 0x57F287,       // 그린
      leave: 0xED4245,      // 레드
      message: 0xFEE75C,    // 옐로우
      reaction: 0xEB459E,   // 퍼시픽
      error: 0xED4245,      // 레드
      warn: 0xFEE75C,       // 옐로우
      info: 0x5865F2,       // 블루베리
      activity: 0x9B59B6,   // 퍼플
      default: 0x808080     // 그레이
    };
    
    // 이벤트 유형에 따른 아이콘 설정
    const iconMap = {
      command: '🤖',
      join: '➕',
      leave: '➖',
      message: '💬',
      reaction: '👍',
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      activity: '📊',
      default: '📋'
    };
    
    const icon = iconMap[eventType] || iconMap.default;
    const color = colorMap[eventType] || colorMap.default;

    // 임베드 필드 구성
    const fields = [
      { name: '서버 ID', value: serverId || 'N/A', inline: true },
      { name: '서버 이름', value: serverName || 'N/A', inline: true },
      { name: '이벤트 시간', value: new Date(timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), inline: true }
    ];
    
    // 사용자 정보가 있는 경우 추가
    if (userId) {
      fields.push({ name: '사용자 ID', value: userId, inline: true });
    }
    
    if (userName) {
      fields.push({ name: '사용자 이름', value: userName, inline: true });
    }
    
    // 추가 데이터가 있는 경우 필드에 추가
    if (data && Object.keys(data).length > 0) {
      let dataString = '';
      
      // 데이터 크기가 큰 경우 JSON으로 포맷팅
      if (Object.keys(data).length > 3) {
        dataString = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
        fields.push({ name: '상세 데이터', value: dataString, inline: false });
      } else {
        // 데이터 크기가 작은 경우 개별 필드로 추가
        Object.entries(data).forEach(([key, value]) => {
          let fieldValue = value;
          
          // 객체는 JSON 문자열로 변환
          if (typeof value === 'object' && value !== null) {
            fieldValue = '```json\n' + JSON.stringify(value, null, 2) + '\n```';
          }
          
          fields.push({ name: key, value: String(fieldValue).substring(0, 1024), inline: false });
        });
      }
    }

    // Discord Webhook 메시지 구성
    const message = {
      embeds: [{
        title: `${icon} ${eventType.toUpperCase()}`,
        color: color,
        description: `**${serverName || 'Unknown Server'}**에서 **${eventType}** 이벤트가 발생했습니다.`,
        fields: fields,
        footer: { text: '디스코드 봇 로깅 시스템' },
        timestamp: timestamp
      }]
    };

    // Discord Webhook으로 메시지 전송
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Discord Webhook 전송 실패:', errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    console.error('Discord 로깅 오류:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 명령어 실행 로깅
 * @param {Object} options - 옵션 객체
 */
function logCommand(options) {
  const { serverId, serverName, userId, userName, command, args = [], result = null } = options;
  
  return logToDiscord('command', serverId, serverName, userId, userName, {
    command,
    args: args.join(' '),
    result
  });
}

/**
 * 서버 참가 로깅
 * @param {Object} options - 옵션 객체
 */
function logJoin(options) {
  const { serverId, serverName, userId, userName, joinedAt = new Date().toISOString() } = options;
  
  return logToDiscord('join', serverId, serverName, userId, userName, {
    joinedAt
  });
}

/**
 * 서버 퇴장 로깅
 * @param {Object} options - 옵션 객체
 */
function logLeave(options) {
  const { serverId, serverName, userId, userName, leftAt = new Date().toISOString() } = options;
  
  return logToDiscord('leave', serverId, serverName, userId, userName, {
    leftAt
  });
}

/**
 * 메시지 로깅
 * @param {Object} options - 옵션 객체
 */
function logMessage(options) {
  const { serverId, serverName, userId, userName, channelId, channelName, messageId, content, attachments = [] } = options;
  
  return logToDiscord('message', serverId, serverName, userId, userName, {
    channelId,
    channelName,
    messageId,
    content: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length
  });
}

/**
 * 활동 로깅 (일반)
 * @param {Object} options - 옵션 객체
 */
function logActivity(options) {
  const { serverId, serverName, userId, userName, activityType, details = {} } = options;
  
  return logToDiscord('activity', serverId, serverName, userId, userName, {
    activityType,
    ...details
  });
}

/**
 * 에러 로깅
 * @param {Object} options - 옵션 객체
 */
function logError(options) {
  const { serverId, serverName, userId, userName, error, context = {} } = options;
  
  return logToDiscord('error', serverId, serverName, userId, userName, {
    errorMessage: error.message || String(error),
    errorStack: error.stack,
    context
  });
}

module.exports = {
  logToDiscord,
  logCommand,
  logJoin,
  logLeave,
  logMessage,
  logActivity,
  logError
}; 