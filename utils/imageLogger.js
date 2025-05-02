/**
 * utils/imageLogger.js
 * 이미지 로깅을 위한 클라이언트 측 유틸리티 함수
 */

/**
 * 이미지 로그를 Vercel 서버리스 API에 저장합니다.
 * @param {Object} logData - 로그 데이터
 * @param {string} logData.nickname - 사용자 닉네임
 * @param {string} logData.image_url - 이미지 URL
 * @param {string} [logData.messageId] - 메시지 ID (옵션)
 * @param {string} [logData.serverId] - 서버 ID (옵션)
 * @param {string} [logData.serverName] - 서버 이름 (옵션)
 * @returns {Promise<Object>} - API 응답
 */
export async function logImageToVercel(logData) {
  try {
    // 필수 필드 검증
    if (!logData.nickname || !logData.image_url) {
      throw new Error('필수 필드가 누락되었습니다 (nickname, image_url)');
    }
    
    // API 호출
    const response = await fetch('/api/logImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });
    
    // 응답 처리
    const result = await response.json();
    
    if (!response.ok) {
      console.error('이미지 로깅 API 오류:', result);
      throw new Error(result.error || '이미지 로깅 실패');
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('이미지 로깅 오류:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 이미지 로그를 Discord 웹훅으로 직접 전송합니다.
 * @param {Object} logData - 로그 데이터
 * @param {string} logData.nickname - 사용자 닉네임
 * @param {string} logData.image_url - 이미지 URL
 * @param {string} [logData.serverId] - 서버 ID (옵션)
 * @param {string} [logData.serverName] - 서버 이름 (옵션)
 * @returns {Promise<Object>} - API 응답
 */
export async function logImageToWebhook(logData) {
  try {
    // 필수 필드 검증
    if (!logData.nickname || !logData.image_url) {
      throw new Error('필수 필드가 누락되었습니다 (nickname, image_url)');
    }
    
    // API 호출
    const response = await fetch('/api/webhookImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });
    
    // 응답 처리
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Discord 웹훅 API 오류:', result);
      throw new Error(result.error || 'Discord 웹훅 전송 실패');
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Discord 웹훅 전송 오류:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 이미지 로그를 모든 방식으로 저장합니다.
 * (GitHub API + Discord Webhook)
 * @param {Object} logData - 로그 데이터
 * @returns {Promise<Object>} - API 응답
 */
export async function logImageAll(logData) {
  try {
    // 모든 로깅 시스템에 로그 저장
    const [vercelResult, webhookResult] = await Promise.allSettled([
      logImageToVercel(logData),
      logImageToWebhook(logData)
    ]);
    
    // 결과 확인
    const success = 
      (vercelResult.status === 'fulfilled' && vercelResult.value.success) ||
      (webhookResult.status === 'fulfilled' && webhookResult.value.success);
    
    if (!success) {
      console.warn('일부 로깅 시스템에 저장 실패:', { vercelResult, webhookResult });
    }
    
    return {
      success,
      vercel: vercelResult.status === 'fulfilled' ? vercelResult.value : { success: false, error: vercelResult.reason },
      webhook: webhookResult.status === 'fulfilled' ? webhookResult.value : { success: false, error: webhookResult.reason }
    };
  } catch (error) {
    console.error('이미지 로깅 오류:', error);
    return {
      success: false,
      error: error.message,
    };
  }
} 