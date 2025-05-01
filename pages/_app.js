import '../styles/globals.css';
import ActivityTracker from '../components/ActivityTracker';

function MyApp({ Component, pageProps }) {
  // 사용자 ID는 세션, 쿠키 또는 상태 관리 라이브러리에서 가져올 수 있습니다
  // 여기서는 예시로 null 값을 사용합니다
  const userId = null;

  // 환경 변수 출력 (디버깅용)
  if (typeof window !== 'undefined') {
    console.log('NEXT_PUBLIC_DISCORD_WEBHOOK_URL 환경 변수 확인:', 
      process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL ? 
      '설정됨 ✅' : 
      '설정되지 않음 ❌');
  }

  return (
    <>
      {/* 모든 페이지에서 사용자 활동 추적 */}
      <ActivityTracker userId={userId} />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 