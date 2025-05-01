import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { logPageView, logDirectToDiscord } from '../utils/activityLogger';

/**
 * 페이지 뷰와 라우트 변경을 자동으로 추적하는 컴포넌트
 * 
 * 앱 레이아웃에 이 컴포넌트를 포함시키면 모든 페이지 뷰와 라우트 변경을 자동으로 로깅합니다.
 * 
 * @param {Object} props
 * @param {string} props.userId - 사용자 ID (선택적)
 * @returns {null} 이 컴포넌트는 UI를 렌더링하지 않습니다.
 */
export default function ActivityTracker({ userId = null }) {
  const router = useRouter();

  useEffect(() => {
    // 컴포넌트 마운트 시 초기 페이지 뷰 로깅
    if (router.isReady) {
      const path = router.asPath;
      const { query } = router;
      
      // API를 통한 페이지 뷰 로깅
      logPageView(userId);
      
      // 직접 Discord Webhook으로도 로깅 시도 (API 우회)
      logDirectToDiscord('page_view', userId, path, {
        title: document.title,
        referrer: document.referrer || 'direct',
        query: JSON.stringify(query)
      }).catch(error => {
        console.error('직접 페이지 뷰 로깅 실패:', error);
      });
    }
    
    // 라우트 변경 이벤트 핸들러
    const handleRouteChange = (url) => {
      // API를 통한 라우트 변경 로깅
      logPageView(userId);
      
      // 직접 Discord Webhook으로도 로깅 시도 (API 우회)
      logDirectToDiscord('route_change', userId, url, {
        title: document.title,
        referrer: window.location.pathname,
        previousPath: window.location.pathname
      }).catch(error => {
        console.error('직접 라우트 변경 로깅 실패:', error);
      });
    };

    // 라우트 변경 이벤트 리스너 등록
    router.events.on('routeChangeComplete', handleRouteChange);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.isReady, router.asPath, userId, router, router.events, router.query]);

  // UI를 렌더링하지 않음
  return null;
} 