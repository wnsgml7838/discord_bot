import { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  subDays, parseISO, format, isWithinInterval, startOfDay, endOfDay,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';

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
        <Link href="/calendar" className="inline-flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>캘린더 보기</span>
        </Link>
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
                <LineChart 
                  title={`일일 참여율 (최근 14일) - 평균: ${statsData.participationRateData?.average || 0}%`}
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
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <HeatmapChart 
                  title="요일별 제출 현황" 
                  data={statsData.dayOfWeekData.data} 
                  labels={statsData.dayOfWeekData.labels}
                  colorGradient="blue"
                />
                <HeatmapChart 
                  title="시간대별 제출 현황" 
                  data={statsData.timeOfDayData.data} 
                  labels={statsData.timeOfDayData.labels}
                  colorGradient="green"
                />
              </div>
              
              {/* 새로운 차트 배치: 미제출자 추이와 리마인더 효과를 한 행에 배치 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 새로운 차트 1: 최근 3일간 미제출자 수 추이 */}
                <div>
                  <LineChart 
                    title={`최근 3일간 미제출자 수 추이 - 평균: ${statsData.consecutiveNonSubmittersData?.average || 0}명`}
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
                
                {/* 새로운 차트 2: 리마인더 전후 22시 이후 제출 비율 비교 */}
                <div>
                  <HeatmapChart 
                    title={`리마인더 효과 분석: 22시~01시 제출 비율`}
                    data={statsData.reminderEffectData?.data || []}
                    labels={statsData.reminderEffectData?.labels || []}
                    colorGradient="purple"
                    tooltipCallback={(value, context) => {
                      const index = context.dataIndex;
                      const isBeforeReminder = index === 0;
                      const count = isBeforeReminder 
                        ? statsData.reminderEffectData?.beforeCount 
                        : statsData.reminderEffectData?.afterCount;
                      const total = isBeforeReminder 
                        ? statsData.reminderEffectData?.beforeTotal
                        : statsData.reminderEffectData?.afterTotal;
                      return `${value}% (${count}/${total})`;
                    }}
                    extraInfo={
                      statsData.reminderEffectData?.afterReminder > statsData.reminderEffectData?.beforeReminder
                        ? `리마인더 효과: +${(statsData.reminderEffectData?.afterReminder - statsData.reminderEffectData?.beforeReminder).toFixed(1)}%p 증가`
                        : `리마인더 효과 없음: ${(statsData.reminderEffectData?.beforeReminder - statsData.reminderEffectData?.afterReminder).toFixed(1)}%p 감소`
                    }
                  />
                </div>
              </div>
            </section>
            
            {/* 📉 하단 영역: 알림 및 갤러리 */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">현황 및 알림</h2>
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