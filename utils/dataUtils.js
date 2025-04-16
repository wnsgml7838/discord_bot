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
  const date = new Date(timestamp);
  // KST는 UTC+9
  date.setHours(date.getHours() + 9);
  return date;
}

/**
 * 스터디 기준일 계산 (당일 오전 2시 ~ 다음날 오전 2시)
 * @param {Date|string} date - UTC 날짜 객체 또는 문자열
 * @returns {string} 스터디 기준일 (YYYY-MM-DD)
 */
function getStudyDate(date) {
  // 항상 KST로 변환
  const kstDate = toKSTDate(date);
  const hours = kstDate.getHours();
  
  // KST 기준 오전 2시 이전이면 전날을 기준일로 설정
  if (hours < 2) {
    const prevDay = new Date(kstDate);
    prevDay.setDate(prevDay.getDate() - 1);
    return format(prevDay, 'yyyy-MM-dd');
  }
  
  return format(kstDate, 'yyyy-MM-dd');
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
      // 타임스탬프를 KST로 변환하여 요일 계산
      const date = toKSTDate(log.timestamp);
      const dayOfWeek = date.getDay(); // 0: 일요일, 6: 토요일
      
      // 유효한 요일 인덱스인지 확인
      if (dayOfWeek >= 0 && dayOfWeek <= 6) {
        submissionsByDay[dayOfWeek]++;
      }
    } catch (error) {
      console.error('요일 계산 중 오류:', error);
      // 오류 발생 시 현재 날짜의 요일 기준으로 카운트
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
    const timestamp = log.timestamp;
    // KST 시간으로 변환하여 시간(hour) 추출
    const hour = toKSTDate(timestamp).getHours();
    submissionsByHour[hour]++;
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
  // 오늘 날짜 (로컬 시간)
  const today = new Date();
  
  // 봇 사용자 이름 목록 - 제외할 봇의 닉네임
  const botNames = ['codingtest_check_bot'];
  
  // 모든 사용자 목록에서 봇 제외
  const allUsers = new Set(
    logs
      .map(log => log.nickname)
      .filter(nickname => !botNames.includes(nickname))
  );
  
  // 실제 사용자 수 (봇 제외)
  // const totalUsers = allUsers.size; // 동적으로 계산
  const totalUsers = 31; // 고정 사용자 수 (YEARDREAM 5기 스터디 기준)
  
  // 디버깅을 위해 사용자 정보 로깅
  console.log(`필터링 후 사용자 수: ${allUsers.size}`);
  console.log(`계산에 사용할 총 사용자 수: ${totalUsers}`);
  
  if (totalUsers === 0) return { labels: [], data: [], average: 0 };
  
  // 날짜 범위를 생성하고 초기화 (과거 -> 현재 순서)
  const dateData = [];
  
  // 과거부터 현재까지의 날짜 범위 생성 (days-1일 전부터 오늘까지)
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const displayDate = format(date, 'MM.dd', { locale: ko });
    
    dateData.push({
      date: dateStr,
      displayDate: displayDate,
      participants: new Set()
    });
  }
  
  // 로그 데이터 분석하여 날짜별 제출자 집계 (스터디 기준일 사용)
  logs.forEach(log => {
    // 봇 제외
    if (botNames.includes(log.nickname)) return;
    
    // 스터디 기준일 적용 (당일 오전 2시 ~ 차일 오전 2시)
    const studyDate = getStudyDate(log.timestamp);
    
    // 해당 날짜를 찾아서 참여자 추가
    const dateEntry = dateData.find(entry => entry.date === studyDate);
    if (dateEntry) {
      dateEntry.participants.add(log.nickname);
    }
  });
  
  // 각 날짜의 참여율 계산
  dateData.forEach(entry => {
    const participants = entry.participants.size;
    console.log(`${entry.date} (${entry.displayDate}) 참여자 수: ${participants}명 / ${totalUsers}명 (${(participants/totalUsers*100).toFixed(1)}%)`);
    entry.rate = parseFloat((participants / totalUsers * 100).toFixed(1));
  });
  
  // 라벨과 데이터 분리
  const labels = dateData.map(entry => entry.displayDate);
  const data = dateData.map(entry => entry.rate);
  
  // 평균 참여율 계산
  const average = data.length > 0 
    ? (data.reduce((acc, val) => acc + val, 0) / data.length).toFixed(1) 
    : 0;
  
  return {
    labels,
    data,
    average: parseFloat(average)
  };
} 