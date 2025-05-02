import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  subDays, parseISO, format, isWithinInterval, startOfDay, endOfDay,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import LoggedLink from '../components/LoggedLink';
import { logUserActivity, logDirectToDiscord } from '../utils/activityLogger';

// 데이터 처리 유틸리티 함수 임포트
import {
  getTotalSubmissions, getAverageSubmissionsPerUser, getMaxStreak,
  getTopSubmitter, getSubmissionsByDayOfWeek, getSubmissionsByHour,
  getTop5Users, getRecentNonSubmitters, getRecentSubmissions,
  getTrendingUsers, getInactiveUsers, getTopStreakUsers,
  getDailyParticipationRate, getConsecutiveNonSubmitters, getReminderEffectData
} from '../utils/dataUtils';

// 컴포넌트 임포트
import StatCard from '../components/StatCard';
import HeatmapChart from '../components/HeatmapChart';
import LineChart from '../components/LineChart';
import AlertCard from '../components/AlertCard';
import ThumbnailGallery from '../components/ThumbnailGallery';

export default function Home() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [statsData, setStatsData] = useState({
    totalSubmissions: 0,
    averagePerUser: 0,
    maxStreak: { streak: 0, nickname: '' },
    topSubmitter: { nickname: '', count: 0 },
    dayOfWeekData: { labels: [], data: [] },
    timeOfDayData: { labels: [], data: [] },
    participationRateData: { labels: [], data: [], average: 0 },
    top5Users: [],
    nonSubmitters: [],
    recentSubmissions: [],
    trendingUsers: [],
    inactiveUsers: [],
    topStreakUsers: [],
    consecutiveNonSubmittersData: { labels: [], data: [], average: 0 },
    reminderEffectData: { labels: [], data: [] }
  });

  useEffect(() => {
    // Discord Webhook 테스트
    const testWebhook = async () => {
      try {
        // 직접 로깅 시도
        if (process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL) {
          await logDirectToDiscord('page_load', null, 'index', {
            test: true,
            timestamp: new Date().toISOString(),
            message: '메인 페이지 로드 테스트'
          });
          console.log('Discord 웹훅 테스트 성공');
        } else {
          console.warn('웹훅 URL이 설정되지 않음');
        }
      } catch (err) {
        console.error('Discord 웹훅 테스트 실패:', err);
      }
    };

    // 페이지 로드 시 활동 로깅 및 웹훅 테스트
    logUserActivity('index_page_view', null, { page: 'index' });
    testWebhook();
    
    // 로그 데이터 가져오기
    fetch('/api/logs')
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.message || '데이터를 가져오는데 문제가 발생했습니다.');
          });
        }
        return response.json();
      })
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
        
        // 로그 데이터가 있으면 통계 계산
        if (data.length > 0) {
          calculateStats(data);
        }
      })
      .catch(error => {
        console.error('Error fetching logs:', error);
        setError(error.message || '로그 데이터를 불러오는데 실패했습니다.');
        setLoading(false);
      });
  }, []);
  
  // 통계 데이터 계산
  const calculateStats = (logs) => {
    // 상단 영역 통계
    const totalSubmissions = getTotalSubmissions(logs);
    const averagePerUser = getAverageSubmissionsPerUser(logs);
    const maxStreak = getMaxStreak(logs);
    const topSubmitter = getTopSubmitter(logs);
    
    // 중간 영역 차트 데이터
    const dayOfWeekData = getSubmissionsByDayOfWeek(logs);
    const timeOfDayData = getSubmissionsByHour(logs);
    
    // 일일 참여율 데이터 추가
    const participationRateData = getDailyParticipationRate(logs, 14);
    
    // Top 5 랭커
    const top5Users = getTop5Users(logs);
    
    // 기간별 추이 데이터 (Top 5 사용자)
    // 기존 Top 5 랭커 제출 추이 데이터 대신 새로운 데이터 사용
    // const top5LineChartData = prepareLineChartData(logs, top5Users);
    
    // 최근 3일간 미제출자 수 추이 데이터
    const consecutiveNonSubmittersData = getConsecutiveNonSubmitters(logs, 14);
    
    // 리마인더 전후 22시 이후 제출 비율 비교 데이터
    const reminderEffectData = getReminderEffectData(logs);
    
    // 하단 영역 알림 데이터
    const nonSubmitters = getRecentNonSubmitters(logs, 3);
    const recentSubmissions = getRecentSubmissions(logs, 6);
    const trendingUsers = getTrendingUsers(logs);
    const inactiveUsers = getInactiveUsers(logs, 3);
    const topStreakUsers = getTopStreakUsers(logs);
    
    setStatsData({
      totalSubmissions,
      averagePerUser,
      maxStreak,
      topSubmitter,
      dayOfWeekData,
      timeOfDayData,
      participationRateData,
      top5Users,
      consecutiveNonSubmittersData,
      reminderEffectData,
      nonSubmitters,
      recentSubmissions,
      trendingUsers,
      inactiveUsers,
      topStreakUsers
    });
  };
  
  // Top 5 사용자의 제출 추이 데이터 준비
  const prepareLineChartData = (logs, top5Users) => {
    // 최근 14일 날짜 범위 생성
    const today = new Date();
    const twoWeeksAgo = subDays(today, 13);
    const dateRange = eachDayOfInterval({ start: twoWeeksAgo, end: today });
    const labels = dateRange.map(date => format(date, 'MM.dd', { locale: ko }));
    
    // 상위 5명 사용자별 일자별 제출 횟수 계산
    const datasets = top5Users.map(user => {
      const userLogs = logs.filter(log => log.nickname === user.nickname);
      
      const data = dateRange.map(date => {
        return userLogs.filter(log => {
          const logDate = parseISO(log.timestamp);
          return isSameDay(logDate, date);
        }).length;
      });
      
      return {
        label: user.nickname,
        data
      };
    });
    
    return { labels, datasets };
  };

  // 이미지 미리보기 모달 표시
  const openImagePreview = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // 이미지 미리보기 모달 닫기
  const closeImagePreview = () => {
    setSelectedImage(null);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Head>
        <title>YEARDREAM 5th ALGORITHM</title>
        <meta name="description" content="코딩테스트 인증 스터디 대시보드" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-center mb-2">YEARDREAM 5th ALGORITHM </h1>
        <p className="text-center text-gray-600">스터디 참여 현황 및 데이터 분석</p>
      </header>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="flex space-x-4">
          <Link href="/recommend" className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>문제 추천</span>
          </Link>
          <Link href="/calendar" className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>캘린더 보기</span>
          </Link>
        </div>
      </div>

      <main>
        {loading ? (
          <div className="text-center py-10">로딩 중...</div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            {error}
          </div>
        ) : (
          <>
            {/* 🔼 상단 영역: 주요 통계 */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">스터디 현황 요약</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard 
                  title="누적 제출 횟수" 
                  value={statsData.totalSubmissions} 
                  caption="전체 스터디원들의 인증 횟수"
                  color="blue"
                />
                <StatCard 
                  title="평균 제출 횟수" 
                  value={statsData.averagePerUser} 
                  caption="스터디원 1인당 인증 횟수"
                  color="green"
                />
                <StatCard 
                  title="최장 연속 인증일" 
                  value={statsData.maxStreak.streak} 
                  caption={`최고 기록: ${statsData.maxStreak.nickname || '-'}`}
                  color="amber"
                />
                <StatCard 
                  title="최다 제출자" 
                  value={statsData.topSubmitter.nickname || '-'} 
                  caption={`${statsData.topSubmitter.count || 0}회 제출`}
                  color="purple"
                />
                <StatCard 
                  title="평균 참여율" 
                  value={`${statsData.participationRateData?.average || 0}%`} 
                  caption="최근 14일 기준"
                  color="indigo"
                />
              </div>
            </section>
            
            {/* 🔽 중간 영역: 데이터 시각화 */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">제출 패턴 분석</h2>
              
              {/* 일일 참여율 차트 추가 */}
              <div className="mb-6">
                <div className="card">
                  <h3 className="card-title mb-2">
                    일일 참여율 (최근 14일) - 평균: {statsData.participationRateData?.average || 0}%
                  </h3>
                  <div className="w-full h-[230px]">
                    <LineChart 
                      title=""
                      datasets={[{
                        label: '참여율(%)',
                        data: statsData.participationRateData?.data || [],
                        borderColor: 'rgba(79, 70, 229, 1)',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)'
                      }]}
                      labels={statsData.participationRateData?.labels || []}
                      yAxisLabel="%"
                      suggestedMax={100}
                      tooltipLabel="참여율"
                      tooltipSuffix="%"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h3 className="card-title mb-2">
                    요일별 제출 현황
                  </h3>
                  <div className="w-full h-[280px]">
                    <HeatmapChart 
                      data={statsData.dayOfWeekData.data} 
                      labels={statsData.dayOfWeekData.labels}
                      colorGradient="blue"
                      horizontal={true}
                    />
                  </div>
                </div>
                <div className="card">
                  <h3 className="card-title mb-2">
                    시간대별 제출 현황
                  </h3>
                  <div className="w-full h-[280px]">
                    <HeatmapChart 
                      data={statsData.timeOfDayData.data} 
                      labels={statsData.timeOfDayData.labels}
                      colorGradient="green"
                      horizontal={true}
                    />
                  </div>
                </div>
              </div>
              
              {/* 새로운 차트 배치: 미제출자 추이와 리마인더 효과를 한 행에 배치 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 최근 3일간 미제출자 수 추이 */}
                <div className="card">
                  <h3 className="card-title mb-2">
                    최근 3일간 미제출자 수 추이 - 평균: {statsData.consecutiveNonSubmittersData?.average || 0}명
                  </h3>
                  <div className="w-full h-[280px]">
                    <LineChart 
                      title=""
                      datasets={[{
                        label: '미제출자 수',
                        data: statsData.consecutiveNonSubmittersData?.data || [],
                        borderColor: 'rgba(239, 68, 68, 1)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                      }]}
                      labels={statsData.consecutiveNonSubmittersData?.labels || []}
                      yAxisLabel="인원수"
                      tooltipLabel="미제출자"
                      tooltipSuffix="명"
                    />
                  </div>
                </div>
                
                {/* 리마인더 전후 22시 이후 제출 비율 비교 */}
                <div className="card">
                  <h3 className="card-title mb-2">리마인더 효과 (22시 이후 제출 비율)</h3>
                  <div className="relative">
                    <HeatmapChart
                      data={statsData.reminderEffectData?.data || [0, 0]}
                      labels={statsData.reminderEffectData?.labels || ['리마인더 전', '리마인더 후']}
                      colorGradient="amber"
                      horizontal={false}
                      tooltipCallback={(context) => `${context.dataset.data[context.dataIndex]}% 제출`}
                    />
                    <div className="mt-4 text-center text-sm text-gray-300">
                      <p className="font-medium">
                        리마인더 효과: 
                        <span className={`ml-1 ${statsData.reminderEffectData?.difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {statsData.reminderEffectData?.difference > 0 ? '+' : ''}{statsData.reminderEffectData?.difference || 0}%p 증가
                        </span>
                        <span className="block mt-1 text-xs text-gray-500">
                          (전: {statsData.reminderEffectData?.beforeCount || 0}개, 후: {statsData.reminderEffectData?.afterCount || 0}개)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* 📉 하단 영역: 알림 및 갤러리 */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">현황 및 알림</h2>
              
              {/* 백준 문제 추천 기능 홍보 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 mb-6 text-white">
                <h3 className="text-xl font-bold mb-2">✨ 새로운 기능: 백준 문제 추천 시스템</h3>
                <p className="mb-3">
                  solved.ac API 기반으로 개인화된 백준 문제를 추천해 드립니다.
                  코딩테스트 준비와 백준 티어 향상에 도움이 필요하신가요?
                </p>
                <ul className="list-disc list-inside mb-4 space-y-1">
                  <li>맞춤형 문제 추천: 풀이 패턴, 취약점 분석 기반</li>
                  <li>데일리 챌린지: 리뷰, 적정 난이도, 도전 문제 3단계 구성</li>
                  <li>코딩테스트 준비: 골드 티어 도달을 위한 체계적 로드맵</li>
                </ul>
                <LoggedLink 
                  href="/recommend"
                  className="inline-flex items-center bg-white text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                  id="baekjoon-recommend-link"
                  metadata={{ from_page: 'index', action: 'goto_recommend' }}
                >
                  추천 받으러 가기
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </LoggedLink>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <AlertCard 
                  title="최근 3일간 미제출자" 
                  items={statsData.nonSubmitters.map(nickname => nickname)}
                  type="warning"
                />
                <AlertCard 
                  title="트렌드 알림" 
                  items={[
                    ...(statsData.trendingUsers.map(user => ({
                      text: `${user.nickname}: 증가 중`,
                      caption: `(+${user.increase}회)`
                    }))),
                    ...(statsData.inactiveUsers.slice(0, 3).map(user => ({
                      text: `${user.nickname}: 쉬는 중`,
                      caption: `(${user.daysSinceLastSubmission}일 째)`
                    }))),
                    ...(statsData.topStreakUsers.map(user => ({
                      text: `${user.nickname}: 연속 인증`,
                      caption: `(${user.streak}일)`
                    })))
                  ]}
                  type="info"
                />
                <AlertCard 
                  title="랭킹 TOP 5" 
                  items={statsData.top5Users.map(user => ({
                    text: user.nickname,
                    caption: `(${user.count}회 제출)`
                  }))}
                  type="success"
                />
              </div>
              
              <div className="mt-6">
                <ThumbnailGallery 
                  submissions={statsData.recentSubmissions}
                  onImageClick={openImagePreview}
                />
              </div>
            </section>
          </>
        )}
      </main>

      {/* 이미지 미리보기 모달 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-auto">
            <div className="p-4 flex justify-between items-center border-b">
              <h3 className="text-lg font-semibold">인증 이미지</h3>
              <button 
                onClick={closeImagePreview}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <img 
                src={selectedImage} 
                alt="인증 이미지" 
                className="w-full h-auto"
                style={{ maxHeight: '70vh' }}
              />
            </div>
            <div className="p-4 border-t flex justify-end">
              <a 
                href={selectedImage} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                원본 이미지 보기
              </a>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 pt-8 border-t border-gray-300 text-center text-gray-600">
        <p>코딩테스트 인증 스터디 대시보드 © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
} 