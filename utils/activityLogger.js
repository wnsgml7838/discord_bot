/**
 * utils/activityLogger.js
 * 사용자 활동을 Discord Webhook으로 전송하는 클라이언트 측 유틸리티
 */

// 환경변수에서 Discord Webhook URL을 가져옴
const DISCORD_WEBHOOK_URL = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL;

/**
 * 사용자 활동을 API를 통해 로깅하는 함수
 * @param {string} event - 이벤트 이름 (예: 'button_click', 'page_view')
 * @param {string} userId - 사용자 ID (선택적)
 * @param {Object} metadata - 추가 메타데이터 (선택적)
 * @returns {Promise<Object>} - 로깅 결과
 */
export const logUserActivity = async (event, userId = null, metadata = null) => {
  // 현재 페이지 경로 가져오기
  const page = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
  
  try {
    // 로깅 API 엔드포인트로 이벤트 데이터 전송
    const response = await fetch('/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        userId,
        page,
        metadata,
        timestamp: new Date().toISOString(),
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Failed to log user activity:', error);
    // API 로깅에 실패하면 직접 Discord Webhook 호출 시도
    try {
      await logDirectToDiscord(event, userId, page, metadata);
      return { success: true, message: 'Logged directly to Discord webhook' };
    } catch (webhookError) {
      console.error('Failed to log directly to Discord:', webhookError);
      return { success: false, error: error.message, webhookError };
    }
  }
};

/**
 * API를 거치지 않고 직접 Discord Webhook으로 로깅하는 함수
 * @param {string} event - 이벤트 이름
 * @param {string} userId - 사용자 ID
 * @param {string} page - 페이지 경로
 * @param {Object} metadata - 추가 메타데이터
 * @returns {Promise<Object>} - 응답 객체
 */
export const logDirectToDiscord = async (event, userId = null, page = null, metadata = null) => {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('Discord Webhook URL이 설정되지 않았습니다. (NEXT_PUBLIC_DISCORD_WEBHOOK_URL)');
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const currentPage = page || (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown';

    // Discord에 전송할 메시지 구성
    const message = {
      embeds: [{
        title: `📊 사용자 활동: ${event}`,
        color: 0x00AAFF, // 파란색
        fields: [
          { name: '이벤트', value: event, inline: true },
          { name: '페이지', value: currentPage, inline: true },
          { name: '사용자 ID', value: userId || 'Anonymous', inline: true },
          { name: '시간', value: new Date().toISOString(), inline: true },
          { name: 'User Agent', value: userAgent, inline: false }
        ],
        footer: { text: 'Vercel 앱 직접 로깅 (API 우회)' },
        timestamp: new Date().toISOString()
      }]
    };

    // 추가 메타데이터가 있는 경우 필드에 추가
    if (metadata) {
      message.embeds[0].fields.push({
        name: '추가 데이터',
        value: '```json\n' + JSON.stringify(metadata, null, 2) + '\n```',
        inline: false
      });
    }

    // Discord Webhook으로 메시지 전송
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Discord 직접 로깅 오류:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 페이지 뷰 이벤트를 자동으로 로깅
 * @param {string} userId - 사용자 ID (선택적)
 */
export const logPageView = (userId = null) => {
  if (typeof window !== 'undefined') {
    // 페이지 로드 시 자동으로 페이지 뷰 이벤트 로깅
    logUserActivity('page_view', userId, {
      title: document.title,
      referrer: document.referrer || 'direct',
    });
  }
};

/**
 * 버튼 클릭 이벤트를 로깅하는 함수
 * @param {string} buttonId - 버튼 ID나 이름
 * @param {string} userId - 사용자 ID (선택적)
 * @param {Object} metadata - 추가 메타데이터 (선택적)
 */
export const logButtonClick = (buttonId, userId = null, metadata = {}) => {
  logUserActivity('button_click', userId, {
    buttonId,
    ...metadata,
  });
};

/**
 * 폼 제출 이벤트를 로깅하는 함수
 * @param {string} formId - 폼 ID나 이름
 * @param {string} userId - 사용자 ID (선택적)
 * @param {Object} metadata - 추가 메타데이터 (선택적)
 */
export const logFormSubmit = (formId, userId = null, metadata = {}) => {
  logUserActivity('form_submit', userId, {
    formId,
    ...metadata,
  });
};

/**
 * 에러 이벤트를 로깅하는 함수
 * @param {Error} error - 에러 객체
 * @param {string} userId - 사용자 ID (선택적)
 */
export const logError = (error, userId = null) => {
  logUserActivity('error', userId, {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
};

// 기본 내보내기
export default { 
  logUserActivity,
  logPageView,
  logButtonClick,
  logFormSubmit,
  logError,
  logDirectToDiscord
}; 