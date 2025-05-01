import React from 'react';
import { logButtonClick, logDirectToDiscord } from '../utils/activityLogger';

/**
 * 클릭 이벤트를 자동으로 로깅하는 버튼 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.id - 버튼 ID (로깅용)
 * @param {string} props.userId - 사용자 ID (선택적)
 * @param {Object} props.metadata - 추가 로깅 메타데이터 (선택적)
 * @param {Function} props.onClick - 기존 onClick 핸들러 (선택적)
 * @param {React.ReactNode} props.children - 버튼 내용
 * @param {string} props.className - CSS 클래스 (선택적)
 */
export default function LoggedButton({
  id,
  userId = null,
  metadata = {},
  onClick,
  children,
  className = '',
  ...props
}) {
  // 클릭 이벤트 처리 및 로깅
  const handleClick = (e) => {
    // 클릭 이벤트 로깅
    logButtonClick(id || 'unnamed-button', userId, {
      buttonType: props.type || 'button',
      ...metadata
    });
    
    // 직접 Discord Webhook으로도 로깅 시도 (API 우회)
    logDirectToDiscord('button_click', userId, null, {
      buttonId: id || 'unnamed-button',
      buttonType: props.type || 'button',
      from_page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...metadata
    }).catch(error => {
      console.error('직접 로깅 실패:', error);
    });

    // 기존 onClick 핸들러 호출 (있는 경우)
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      id={id}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
} 