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
    // 날짜를 YYYY-MM-DD 형식으로 변환하고 중복 제거 (하루에 여러 번 제출 가능)
    const dates = [...new Set(userLog.map(log => log.timestamp.split('T')[0]))].sort();
    
    let currentStreak = 1;
    let maxStreak = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i-1]);
      const currDate = new Date(dates[i]);
      
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
 * 요일별 제출 횟수 계산
 */
export function getSubmissionsByDayOfWeek(logs) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const submissionsByDay = Array(7).fill(0);
  
  logs.forEach(log => {
    const date = parseISO(log.timestamp);
    const dayIndex = date.getDay(); // 0-6 (일-토)
    submissionsByDay[dayIndex]++;
  });
  
  return {
    labels: days,
    data: submissionsByDay
  };
}

/**
 * 시간대별 제출 횟수 계산
 */
export function getSubmissionsByTimeOfDay(logs) {
  const timeRanges = ['06-09', '09-12', '12-15', '15-18', '18-21', '21-24', '00-06'];
  const submissionsByTime = Array(7).fill(0);
  
  logs.forEach(log => {
    const date = parseISO(log.timestamp);
    const hours = date.getHours();
    
    let timeIndex;
    if (hours >= 6 && hours < 9) timeIndex = 0;
    else if (hours >= 9 && hours < 12) timeIndex = 1;
    else if (hours >= 12 && hours < 15) timeIndex = 2;
    else if (hours >= 15 && hours < 18) timeIndex = 3;
    else if (hours >= 18 && hours < 21) timeIndex = 4;
    else if (hours >= 21 && hours < 24) timeIndex = 5;
    else timeIndex = 6; // 00-06
    
    submissionsByTime[timeIndex]++;
  });
  
  return {
    labels: timeRanges,
    data: submissionsByTime
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
    const logDate = parseISO(log.timestamp);
    if (isAfter(logDate, dateThreshold)) {
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