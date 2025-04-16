import { format, isAfter, isBefore, subDays, parseISO, differenceInDays, isEqual } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 사용자별 제출 횟수 계산
 */
export function getUserSubmissionCounts(logs) {
  const userCounts = {};
  
  logs.forEach(log => {
    const { nickname } = log;
    userCounts[nickname] = (userCounts[nickname] || 0) + 1;
  });
  
  return userCounts;
}

/**
 * 전체 스터디원 수를 반환
 */
export function getTotalUniqueUsers(logs) {
  return new Set(logs.map(log => log.nickname)).size;
}

/**
 * 전체 제출 횟수 계산
 */
export function getTotalSubmissions(logs) {
  return logs.length;
}

/**
 * 스터디원 1인당 평균 제출 횟수 계산
 */
export function getAverageSubmissionsPerUser(logs) {
  const totalUsers = getTotalUniqueUsers(logs);
  const totalSubmissions = getTotalSubmissions(logs);
  
  return totalUsers ? (totalSubmissions / totalUsers).toFixed(1) : 0;
}

/**
 * 최다 제출자 계산
 */
export function getTopSubmitter(logs) {
  const userCounts = getUserSubmissionCounts(logs);
  let topUser = null;
  let maxCount = 0;
  
  Object.entries(userCounts).forEach(([nickname, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topUser = nickname;
    }
  });
  
  return { nickname: topUser, count: maxCount };
}

/**
 * 날짜별 제출 데이터 생성
 */
export function getSubmissionsByDate(logs) {
  const submissionsByDate = {};
  
  logs.forEach(log => {
    const date = log.timestamp.split('T')[0]; // YYYY-MM-DD 형식으로 변환
    submissionsByDate[date] = (submissionsByDate[date] || 0) + 1;
  });
  
  return submissionsByDate;
}

/**
 * UTC 타임스탬프를 KST(한국 표준시)로 변환
 * @param {string} timestamp - ISO 형식의 타임스탬프
 * @returns {Date} KST로 변환된 Date 객체
 */
export function toKSTDate(timestamp) {
  // ISO 문자열에서 Date 객체 생성
  const date = new Date(timestamp);
  
  // UTC 시간에서 KST로 변환 (UTC+9)
  const utcDate = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  
  // 9시간 추가 (KST = UTC+9)
  utcDate.setHours(utcDate.getHours() + 9);
  
  return utcDate;
}

/**
 * 스터디 기준일 계산 (당일 오전 2시 ~ 다음날 오전 2시)
 * @param {Date|string} timestamp - UTC 날짜 객체 또는 문자열
 * @returns {string} 스터디 기준일 (YYYY-MM-DD)
 */
function getStudyDate(timestamp) {
  // ISO 형식의 타임스탬프에서 Date 객체 생성
  const date = new Date(timestamp);
  
  // UTC 날짜와 시간 성분 추출
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDate = date.getUTCDate();
  const utcHours = date.getUTCHours();
  
  // KST 시간 계산 (UTC+9)
  let kstHours = (utcHours + 9) % 24;
  let kstDate = utcDate;
  let kstMonth = utcMonth;
  let kstYear = utcYear;
  
  // UTC 기준으로 날짜 변경 처리
  if (utcHours + 9 >= 24) {
    // 날짜가 바뀌는 경우
    kstDate += 1;
    
    // 월말 처리
    const lastDayOfMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
    if (kstDate > lastDayOfMonth) {
      kstDate = 1;
      kstMonth += 1;
      
      // 연말 처리
      if (kstMonth > 11) {
        kstMonth = 0;
        kstYear += 1;
      }
    }
  }
  
  // KST 기준 오전 2시 이전이면 전날을 기준일로 설정
  if (kstHours < 2) {
    // 전날 날짜 계산
    if (kstDate === 1) {
      // 월초인 경우 전 월의 마지막 날로 설정
      kstMonth = kstMonth === 0 ? 11 : kstMonth - 1;
      kstYear = kstMonth === 11 ? kstYear - 1 : kstYear;
      kstDate = new Date(kstYear, kstMonth + 1, 0).getDate();
    } else {
      kstDate -= 1;
    }
  }
  
  // YYYY-MM-DD 형식의 문자열로 반환
  return `${kstYear}-${String(kstMonth + 1).padStart(2, '0')}-${String(kstDate).padStart(2, '0')}`;
}

/**
 * 사용자별 최장 연속 인증일수(스트릭) 계산
 */
export function getUserStreaks(logs) {
  // 사용자별로 로그를 그룹화
  const userLogs = {};
  logs.forEach(log => {
    if (!userLogs[log.nickname]) {
      userLogs[log.nickname] = [];
    }
    userLogs[log.nickname].push(log);
  });
  
  const streaks = {};
  
  // 각 사용자별로 스트릭 계산
  Object.entries(userLogs).forEach(([nickname, userLog]) => {
    // 스터디 기준일(당일 오전 2시 ~ 차일 오전 2시)로 변환하고 중복 제거
    const studyDates = [...new Set(userLog.map(log => getStudyDate(log.timestamp)))].sort();
    
    let currentStreak = 1;
    let maxStreak = 1;
    
    for (let i = 1; i < studyDates.length; i++) {
      const prevDate = new Date(studyDates[i-1]);
      const currDate = new Date(studyDates[i]);
      
      // 현재 날짜가 이전 날짜의 다음 날인지 확인
      if (differenceInDays(currDate, prevDate) === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    streaks[nickname] = maxStreak;
  });
  
  return streaks;
}

/**
 * 최장 연속 인증일 수 계산
 */
export function getMaxStreak(logs) {
  const streaks = getUserStreaks(logs);
  let maxStreak = 0;
  let maxStreakUser = '';
  
  Object.entries(streaks).forEach(([nickname, streak]) => {
    if (streak > maxStreak) {
      maxStreak = streak;
      maxStreakUser = nickname;
    }
  });
  
  return { streak: maxStreak, nickname: maxStreakUser };
}

/**
 * 요일별 제출 수 계산 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 * @param {Array} logs - 로그 데이터 배열
 * @returns {Object} 요일별 제출 수 객체 {labels: [요일명], data: [제출 수]}
 */
export function getSubmissionsByDayOfWeek(logs) {
  // 요일별 제출 수 초기화 (0: 일요일, 1: 월요일, ..., 6: 토요일)
  const submissionsByDay = [0, 0, 0, 0, 0, 0, 0];
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  
  logs.forEach(log => {
    try {
      // ISO 형식의 타임스탬프에서 Date 객체 생성
      const date = new Date(log.timestamp);
      
      // UTC 날짜와 시간 성분 추출
      const utcYear = date.getUTCFullYear();
      const utcMonth = date.getUTCMonth();
      const utcDate = date.getUTCDate();
      const utcHours = date.getUTCHours();
      
      // KST 시간 계산 (UTC+9)
      // 시간이 15시(UTC) 이상이면 날짜가 변경됨
      let kstDate = utcDate;
      let kstMonth = utcMonth;
      let kstYear = utcYear;
      
      if (utcHours + 9 >= 24) {
        // 날짜가 바뀌는 경우
        kstDate += 1;
        
        // 월말 처리
        const lastDayOfMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
        if (kstDate > lastDayOfMonth) {
          kstDate = 1;
          kstMonth += 1;
          
          // 연말 처리
          if (kstMonth > 11) {
            kstMonth = 0;
            kstYear += 1;
          }
        }
      }
      
      // KST 기준 날짜 객체 생성
      const kstDateObj = new Date(kstYear, kstMonth, kstDate);
      const dayOfWeek = kstDateObj.getDay(); // 0: 일요일, 6: 토요일
      
      // 요일별 카운트 증가
      submissionsByDay[dayOfWeek]++;
    } catch (error) {
      console.error('요일 계산 중 오류:', error, log.timestamp);
      // 오류 발생 시 현재 날짜의 요일 기준으로 카운트 (로컬 시간 기준)
      const today = new Date().getDay();
      submissionsByDay[today]++;
    }
  });
  
  return {
    labels: days,
    data: submissionsByDay
  };
}

/**
 * 시간대별 제출 수 계산 (0-23시)
 * @param {Array} logs - 로그 데이터 배열
 * @returns {Object} 시간대별 제출 수 객체 {labels: [시간], data: [제출 수]}
 */
export function getSubmissionsByHour(logs) {
  // 0-23시까지의 시간대별 제출 수 초기화
  const submissionsByHour = Array(24).fill(0);

  // 각 로그 항목을 시간대별로 집계
  logs.forEach(log => {
    try {
      // ISO 형식의 타임스탬프에서 UTC 시간을 추출
      const date = new Date(log.timestamp);
      
      // UTC 시간에 9시간을 더해 KST 시간으로 변환
      // UTC 시간 계산
      const utcHour = date.getUTCHours();
      
      // KST 시간 계산 (UTC+9)
      const kstHour = (utcHour + 9) % 24;
      
      // 시간대별 카운트 증가
      submissionsByHour[kstHour]++;
    } catch (error) {
      console.error('시간대 계산 중 오류:', error, log.timestamp);
      // 오류 발생 시 무시하고 계속 진행
    }
  });

  // 시간대 레이블 생성 (00시, 01시, ... 23시)
  const hourLabels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}시`);

  return {
    labels: hourLabels,
    data: submissionsByHour
  };
}

/**
 * Top 5 랭커 추출
 */
export function getTop5Users(logs) {
  const userCounts = getUserSubmissionCounts(logs);
  
  // 제출 횟수로 내림차순 정렬
  const sortedUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nickname, count]) => ({ nickname, count }));
  
  return sortedUsers;
}

/**
 * 최근 N일간 미제출자 명단
 */
export function getRecentNonSubmitters(logs, days = 3) {
  const today = new Date();
  const dateThreshold = subDays(today, days);
  
  // 모든 사용자 목록
  const allUsers = new Set(logs.map(log => log.nickname));
  
  // 최근 N일 동안 제출한 사용자 목록
  const recentSubmitters = new Set();
  logs.forEach(log => {
    // KST 기준으로 변환
    const kstDate = toKSTDate(log.timestamp);
    if (isAfter(kstDate, dateThreshold)) {
      recentSubmitters.add(log.nickname);
    }
  });
  
  // 미제출자 계산
  const nonSubmitters = [...allUsers].filter(user => !recentSubmitters.has(user));
  
  return nonSubmitters;
}

/**
 * 최근 인증 내역 가져오기
 */
export function getRecentSubmissions(logs, count = 6) {
  return logs.slice(0, count);
}

/**
 * 요즘 제출량이 증가 중인 사람 찾기
 */
export function getTrendingUsers(logs) {
  const today = new Date();
  const twoWeeksAgo = subDays(today, 14);
  const oneWeekAgo = subDays(today, 7);
  
  const userSubmissions = {};
  
  // 초기화
  logs.forEach(log => {
    if (!userSubmissions[log.nickname]) {
      userSubmissions[log.nickname] = { pastWeek: 0, currentWeek: 0 };
    }
  });
  
  // 지난 2주간 제출 집계
  logs.forEach(log => {
    const logDate = parseISO(log.timestamp);
    
    if (isAfter(logDate, oneWeekAgo)) {
      userSubmissions[log.nickname].currentWeek++;
    } else if (isAfter(logDate, twoWeeksAgo)) {
      userSubmissions[log.nickname].pastWeek++;
    }
  });
  
  // 제출량이 증가한 사용자 필터링
  const trendingUsers = Object.entries(userSubmissions)
    .filter(([_, { pastWeek, currentWeek }]) => currentWeek > pastWeek && currentWeek > 2)
    .map(([nickname, { pastWeek, currentWeek }]) => ({
      nickname,
      increase: currentWeek - pastWeek,
      currentWeek
    }))
    .sort((a, b) => b.increase - a.increase)
    .slice(0, 3);
  
  return trendingUsers;
}

/**
 * 최근 N일 이상 쉬고 있는 사람
 */
export function getInactiveUsers(logs, days = 3) {
  const today = new Date();
  const dateThreshold = subDays(today, days);
  
  // 사용자별 마지막 제출 날짜
  const lastSubmissionDate = {};
  
  logs.forEach(log => {
    const { nickname, timestamp } = log;
    const logDate = parseISO(timestamp);
    
    if (!lastSubmissionDate[nickname] || isAfter(logDate, lastSubmissionDate[nickname])) {
      lastSubmissionDate[nickname] = logDate;
    }
  });
  
  // N일 이상 쉬고 있는 사용자
  const inactiveUsers = Object.entries(lastSubmissionDate)
    .filter(([_, lastDate]) => isBefore(lastDate, dateThreshold))
    .map(([nickname, lastDate]) => ({
      nickname,
      daysSinceLastSubmission: differenceInDays(today, lastDate)
    }))
    .sort((a, b) => b.daysSinceLastSubmission - a.daysSinceLastSubmission);
  
  return inactiveUsers;
}

/**
 * 스트릭 TOP 3
 */
export function getTopStreakUsers(logs) {
  const streaks = getUserStreaks(logs);
  
  return Object.entries(streaks)
    .map(([nickname, streak]) => ({ nickname, streak }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 3);
}

/**
 * 일일 참여율 계산
 */
export function getDailyParticipationRate(logs, days = 14) {
  const today = new Date();
  const startDate = subDays(today, days - 1);
  
  // 모든 사용자 목록
  const allUsers = new Set(logs.map(log => log.nickname));
  const totalUsers = allUsers.size;
  
  if (totalUsers === 0) return { labels: [], data: [], average: 0 };
  
  // 날짜별 제출 기록 초기화 (스터디 기준일 사용)
  const dailyParticipation = {};
  for (let i = 0; i < days; i++) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    dailyParticipation[dateStr] = new Set();
  }
  
  // 로그 데이터 분석하여 날짜별 제출자 집계 (스터디 기준일 사용)
  logs.forEach(log => {
    // 스터디 기준일 적용 (당일 오전 2시 ~ 차일 오전 2시)
    const studyDate = getStudyDate(log.timestamp);
    
    if (dailyParticipation[studyDate]) {
      dailyParticipation[studyDate].add(log.nickname);
    }
  });
  
  // 날짜 역순으로 정렬 (최신 날짜가 마지막)
  const sortedDates = Object.keys(dailyParticipation).sort();
  
  // 날짜별 참여율 계산 
  const participationData = sortedDates.map(date => {
    const participants = dailyParticipation[date].size;
    const rate = totalUsers > 0 ? (participants / totalUsers * 100).toFixed(1) : 0;
    return parseFloat(rate);
  });
  
  // 날짜 라벨 포맷팅 (MM.DD)
  const dateLabels = sortedDates.map(date => 
    format(parseISO(date), 'MM.dd', { locale: ko })
  );
  
  // 평균 참여율 계산
  const average = participationData.length > 0 
    ? (participationData.reduce((acc, val) => acc + val, 0) / participationData.length).toFixed(1) 
    : 0;
  
  return {
    labels: dateLabels,
    data: participationData,
    average: parseFloat(average)
  };
} 