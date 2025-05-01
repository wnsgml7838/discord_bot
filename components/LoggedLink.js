import React from 'react';
import Link from 'next/link';
import { logButtonClick, logDirectToDiscord } from '../utils/activityLogger';

/**
 * 클릭 이벤트를 자동으로 로깅하는 Next.js Link 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.id - 링크 ID (로깅용)
 * @param {string} props.userId - 사용자 ID (선택적)
 * @param {Object} props.metadata - 추가 로깅 메타데이터 (선택적)
 * @param {string} props.href - 링크 URL
 * @param {React.ReactNode} props.children - 링크 내용
 * @param {string} props.className - CSS 클래스 (선택적)
 */
export default function LoggedLink({
  id,
  userId = null,
  metadata = {},
  href,
  children,
  className = '',
  ...props
}) {
  // 클릭 이벤트 처리 및 로깅
  const handleClick = (e) => {
    // 클릭 이벤트 로깅 (API 를 통해)
    logButtonClick(id || `link-to-${href}`, userId, {
      linkHref: href,
      ...metadata
    });
    
    // 직접 Discord Webhook으로도 로깅 시도 (API 우회)
    logDirectToDiscord('link_click', userId, null, {
      linkId: id || `link-to-${href}`,
      linkHref: href,
      from_page: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...metadata
    }).catch(error => {
      console.error('직접 로깅 실패:', error);
    });
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
} 