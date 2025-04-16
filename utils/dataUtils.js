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
 * @param {Date|string} timestamp - UTC 날짜 객체 또는 문자열
 * @param {string|null} kstTimestampStr - KST 타임스탬프 문자열 (있으면 이것을 우선 사용)
 * @returns {string} 스터디 기준일 (YYYY-MM-DD)
 */
function getStudyDate(timestamp, kstTimestampStr = null) {
  // KST 타임스탬프가 있으면 그것을 우선 사용
  if (kstTimestampStr) {
    try {
      // kstTimestampStr 형식: "2025-04-14 17:11:40"
      const [datePart] = kstTimestampStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hourPart] = kstTimestampStr.split(' ')[1].split(':');
      const hour = parseInt(hourPart, 10);
      
      // KST 기준 오전 2시 이전이면 전날을 기준일로 설정
      let studyDate;
      if (hour < 2) {
        // 전날 날짜 계산
        const prevDate = new Date(year, month - 1, day);
        prevDate.setDate(prevDate.getDate() - 1);
        studyDate = prevDate.toISOString().split('T')[0];
      } else {
        studyDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      
      console.log(`[KST 변환] ${kstTimestampStr} -> 스터디일: ${studyDate} (KST ${hour}시)`);
      return studyDate;
    } catch (error) {
      console.error(`KST 시간 변환 오류: ${error.message}. UTC 시간으로 대체합니다.`);
      // 에러 발생 시 기존 UTC 변환 로직 사용
    }
  }
  
  // ISO 형식의 타임스탬프에서 Date 객체 생성
  const date = new Date(timestamp);
  
  // UTC 시간 기준으로 KST 시간 계산 (UTC+9)
  let kstHours = (date.getUTCHours() + 9) % 24;
  let kstDate = date.getUTCDate();
  let kstMonth = date.getUTCMonth(); // 0-11 범위
  let kstYear = date.getUTCFullYear();
  
  // UTC 기준으로 날짜 변경 처리
  if (date.getUTCHours() + 9 >= 24) {
    // 한국 시간으로 날짜가 바뀌는 경우
    kstDate += 1;
    
    // 월말 처리
    const lastDayOfMonth = new Date(Date.UTC(kstYear, kstMonth + 1, 0)).getUTCDate();
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
      kstDate = new Date(Date.UTC(kstYear, kstMonth + 1, 0)).getUTCDate();
    } else {
      kstDate -= 1;
    }
  }
  
  // YYYY-MM-DD 형식의 문자열로 반환
  const monthStr = String(kstMonth + 1).padStart(2, '0');
  const dateStr = String(kstDate).padStart(2, '0');
  
  // 디버깅 정보 출력 (모든 날짜에 대해)
  const studyDate = `${kstYear}-${monthStr}-${dateStr}`;
  console.log(`[UTC 변환] ${timestamp} -> 스터디일: ${studyDate} (KST ${kstHours}시)`);
  
  return studyDate;
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
    try {
      // ISO 타임스탬프에서 직접 Date 객체 생성
      const date = new Date(log.timestamp);
      
      // UTC 시간에서 KST 시간 계산 (UTC+9)
      // JavaScript getUTCHours()는 0-23 범위의 UTC 시간을 반환
      let kstHour = (date.getUTCHours() + 9) % 24;
      
      // 시간대별 카운트 증가
      submissionsByHour[kstHour]++;
    } catch (error) {
      console.error('시간대 계산 중 오류:', error, log.timestamp);
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
  console.log('========== 참여율 계산 시작 ==========');
  
  // 봇 제외
  const botNames = ['codingtest_check_bot'];
  const filteredLogs = logs.filter(log => !botNames.includes(log.nickname));
  
  // 실제 사용자 목록 (봇 제외)
  const allUsers = new Set(filteredLogs.map(log => log.nickname));
  
  // 실제 사용자 수 사용 (고정값 31 대신)
  const totalUsers = allUsers.size;
  
  console.log(`실제 사용자 수 (봇 제외): ${allUsers.size}`);
  console.log(`계산에 사용하는 사용자 수: ${totalUsers}명`);
  console.log(`등록된 사용자 목록: ${[...allUsers].join(', ')}`);
  
  if (filteredLogs.length === 0) return { labels: [], data: [], average: 0 };
  
  // 1. 로그 데이터에서 모든 스터디 날짜 추출
  const studyDates = new Set();
  filteredLogs.forEach(log => {
    // KST 타임스탬프가 있으면 그것을 사용하여 스터디 기준일 계산
    const studyDate = getStudyDate(log.timestamp, log.kstTimestampStr || null);
    studyDates.add(studyDate);
  });
  
  // 2. 날짜 정렬 (최신순)
  const sortedDates = [...studyDates].sort().reverse();
  
  // 3. 최근 days일만 유지
  const recentDates = sortedDates.slice(0, days);
  
  console.log(`최근 ${days}일 날짜: ${recentDates.join(', ')}`);
  
  // 4. 각 날짜별 참여자 계산
  const dateData = recentDates.map(date => {
    // 해당 날짜에 제출한 사용자들의 닉네임 집합
    const participants = new Set(
      filteredLogs
        .filter(log => getStudyDate(log.timestamp, log.kstTimestampStr || null) === date)
        .map(log => log.nickname)
    );
    
    // 참여율 계산 (항상 31명으로 나누기)
    const participationRate = parseFloat(((participants.size / totalUsers) * 100).toFixed(1));
    
    // 날짜 라벨 포맷팅 (MM.dd)
    const displayDate = format(parseISO(date), 'MM.dd', { locale: ko });
    
    console.log(`\n[${date}] 참여자 수: ${participants.size}명 / ${totalUsers}명 (${participationRate}%)`);
    console.log(`[${date}] 참여자 목록: ${[...participants].join(', ')}`);
    
    // 특정 날짜에 대해 상세 로그 표시
    if (['2025-04-14', '2025-04-15'].includes(date)) {
      console.log(`[${date}] 참여자 상세 정보:`, 
        filteredLogs
          .filter(log => getStudyDate(log.timestamp, log.kstTimestampStr || null) === date)
          .map(log => ({
            nickname: log.nickname, 
            utc: log.timestamp,
            kst: new Date(log.timestamp).toISOString().replace('Z', '+09:00')
          }))
      );
    }
    
    return {
      date,
      displayDate,
      participationRate
    };
  });
  
  // 5. 날짜순으로 다시 정렬 (과거 -> 현재)
  dateData.reverse();
  
  // 6. 라벨과 데이터 추출
  const labels = dateData.map(item => item.displayDate);
  const data = dateData.map(item => item.participationRate);
  
  // 7. 평균 참여율 계산
  const average = data.length > 0 
    ? parseFloat((data.reduce((acc, val) => acc + val, 0) / data.length).toFixed(1))
    : 0;
  
  console.log(`\n평균 참여율: ${average}%`);
  console.log('========== 참여율 계산 종료 ==========');
  
  return {
    labels,
    data,
    average
  };
}

/**
 * 최근 14일간 "최근 3일간 미제출자 수"의 변화 추이
 * @param {Array} logs - 로그 데이터
 * @param {number} days - 조회할 일수 (기본값: 14일)
 * @returns {Object} - 날짜별 3일 연속 미제출자 수 데이터
 */
export function getConsecutiveNonSubmitters(logs, days = 14) {
  console.log('========== 3일 연속 미제출자 분석 시작 ==========');
  
  // 봇 제외
  const botNames = ['codingtest_check_bot'];
  const filteredLogs = logs.filter(log => !botNames.includes(log.nickname));
  
  // 전체 사용자 목록
  const allUsers = new Set(filteredLogs.map(log => log.nickname));
  const totalUsers = allUsers.size;
  
  console.log(`[3일 연속 미제출자 분석] 전체 사용자 수: ${totalUsers}명`);
  console.log(`[3일 연속 미제출자 분석] 사용자 목록: ${[...allUsers].join(', ')}`);
  
  if (filteredLogs.length === 0 || totalUsers === 0) {
    return { labels: [], data: [], average: 0 };
  }
  
  // 날짜별 제출자 맵 생성
  const submittersByDate = {};
  
  // 모든 로그를 순회하며 날짜별 제출자 맵 생성
  filteredLogs.forEach(log => {
    const studyDate = getStudyDate(log.timestamp, log.kstTimestampStr || null);
    
    if (!submittersByDate[studyDate]) {
      submittersByDate[studyDate] = new Set();
    }
    
    submittersByDate[studyDate].add(log.nickname);
  });
  
  // 날짜 정렬 (최신순)
  const sortedDates = Object.keys(submittersByDate).sort().reverse();
  
  console.log(`[3일 연속 미제출자 분석] 전체 날짜 수: ${sortedDates.length}일`);
  console.log(`[3일 연속 미제출자 분석] 날짜 목록: ${sortedDates.join(', ')}`);
  
  // 최근 days일 + 이전 3일(계산용) 유지
  const recentDates = sortedDates.slice(0, days + 3);
  
  console.log(`[3일 연속 미제출자 분석] 분석 대상 날짜: ${recentDates.join(', ')}`);
  
  // 날짜별 제출자 수 출력
  recentDates.forEach(date => {
    const submitters = submittersByDate[date] || new Set();
    console.log(`[3일 연속 미제출자 분석] ${date}: 제출자 ${submitters.size}명 / ${totalUsers}명 (${[...submitters].join(', ')})`);
  });
  
  // 각 날짜별로 3일 연속 미제출자 수 계산
  const results = [];
  
  // 포함된 날짜들만 계산 (가장 오래된 3일은 계산용으로만 사용)
  for (let i = 0; i < recentDates.length - 3; i++) {
    const targetDate = recentDates[i];
    const dayFormat = format(parseISO(targetDate), 'MM.dd', { locale: ko });
    
    // 3일 연속 미제출자 계산
    const consecutiveNonSubmitters = new Set([...allUsers]);
    
    // 해당 날짜와 이전 2일 동안의 제출자 제외
    for (let j = i; j < i + 3; j++) {
      const checkDate = recentDates[j];
      const submitters = submittersByDate[checkDate] || new Set();
      
      // 제출자는 미제출자 집합에서 제외
      submitters.forEach(nickname => {
        consecutiveNonSubmitters.delete(nickname);
      });
    }
    
    console.log(`[3일 연속 미제출자 분석] ${targetDate}(${dayFormat}) 기준 3일 연속 미제출자: ${consecutiveNonSubmitters.size}명 (${[...consecutiveNonSubmitters].join(', ')})`);
    
    results.push({
      date: targetDate,
      displayDate: dayFormat,
      count: consecutiveNonSubmitters.size,
      nonSubmitters: [...consecutiveNonSubmitters]
    });
  }
  
  // 날짜순 정렬 (과거 -> 현재)
  results.reverse();
  
  // 라벨과 데이터 추출
  const labels = results.map(item => item.displayDate);
  const data = results.map(item => item.count);
  
  // 평균 미제출자 수 계산
  const average = data.length > 0
    ? parseFloat((data.reduce((acc, val) => acc + val, 0) / data.length).toFixed(1))
    : 0;
  
  // 비율로 변환
  const percentages = data.map(count => parseFloat(((count / totalUsers) * 100).toFixed(1)));
  
  console.log(`[3일 연속 미제출자 분석] 평균 미제출자 수: ${average}명 (${parseFloat(((average / totalUsers) * 100).toFixed(1))}%)`);
  console.log('========== 3일 연속 미제출자 분석 종료 ==========');
  
  return {
    labels,
    data,
    percentages,
    average,
    percentageAverage: parseFloat(((average / totalUsers) * 100).toFixed(1))
  };
}

/**
 * 리마인더 전후 22시 이후 제출 비율 비교
 * @param {Array} logs - 로그 데이터
 * @returns {Object} - 리마인더 전/후 22시 이후 제출 비율
 */
export function getReminderEffectData(logs) {
  // 봇 제외
  const botNames = ['codingtest_check_bot'];
  const filteredLogs = logs.filter(log => !botNames.includes(log.nickname));
  
  if (filteredLogs.length === 0) {
    return {
      labels: ['리마인더 전', '리마인더 후'],
      beforeReminder: 0,
      afterReminder: 0,
      data: [0, 0],
      beforeCount: 0,
      beforeTotal: 0,
      afterCount: 0,
      afterTotal: 0,
      difference: 0
    };
  }
  
  console.log('========== 리마인더 효과 분석 시작 ==========');
  
  // 리마인더 도입 날짜 (2025-04-06) - 로그 데이터가 2025년으로 기록되어 있음
  const reminderStartDate = '2025-04-06';
  const reminderEndDate = '2025-04-05'; // 리마인더 이전 마지막 날짜
  
  console.log(`[리마인더 효과 분석] 리마인더 도입일: ${reminderStartDate}`);
  console.log(`[리마인더 효과 분석] 전체 로그 수: ${filteredLogs.length}개`);
  
  // 전체 로그 날짜 범위 확인 (디버깅용)
  const allDates = new Set(filteredLogs.map(log => log.timestamp.split('T')[0]));
  console.log(`[리마인더 효과 분석] 로그 날짜 범위: ${Math.min(...[...allDates].map(d => new Date(d).getTime()))} ~ ${Math.max(...[...allDates].map(d => new Date(d).getTime()))}`);
  console.log(`[리마인더 효과 분석] 전체 날짜: ${[...allDates].sort().join(', ')}`);
  
  // 가장 오래된 날짜와 최신 날짜 확인
  const sortedDates = [...allDates].sort();
  console.log(`[리마인더 효과 분석] 가장 오래된 날짜: ${sortedDates[0]}, 최신 날짜: ${sortedDates[sortedDates.length - 1]}`);
  
  // 리마인더 전 날짜만 확인
  const beforeReminderDates = sortedDates.filter(date => date <= reminderEndDate);
  console.log(`[리마인더 효과 분석] 리마인더 전 날짜들: ${beforeReminderDates.join(', ')}`);
  
  // 날짜별 제출자 데이터 구조화
  const submissionsByDate = {};
  
  // 모든 로그를 순회하며 날짜별 제출자 맵 생성
  filteredLogs.forEach(log => {
    // 날짜만 추출 (YYYY-MM-DD 형식)
    const date = log.timestamp.split('T')[0];
    
    // 해당 날짜의 데이터 없으면 초기화
    if (!submissionsByDate[date]) {
      submissionsByDate[date] = {
        allUsers: new Set(),       // 그날 전체 인증한 사용자 (중복 제외)
        lateUsers: new Set()       // 그날 22시 이후 인증한 사용자 (중복 제외)
      };
    }
    
    // 사용자 닉네임 추가
    submissionsByDate[date].allUsers.add(log.nickname);
    
    // KST 시간 확인
    let kstHour;
    if (log.kstTimestampStr) {
      const timeStr = log.kstTimestampStr.split(' ')[1];
      kstHour = parseInt(timeStr.split(':')[0], 10);
    } else {
      const date = new Date(log.timestamp);
      kstHour = (date.getUTCHours() + 9) % 24;
    }
    
    // 22시 이후 인증한 사용자 추가
    if (kstHour >= 22) {
      submissionsByDate[date].lateUsers.add(log.nickname);
    }
  });
  
  // 날짜별 인증 현황 로깅
  console.log('[리마인더 효과 분석] 날짜별 인증 현황:');
  Object.keys(submissionsByDate).sort().forEach(date => {
    const dayData = submissionsByDate[date];
    const totalUsers = dayData.allUsers.size;
    const lateUsers = dayData.lateUsers.size;
    const lateRatio = totalUsers > 0 ? ((lateUsers / totalUsers) * 100).toFixed(1) : '0.0';
    
    console.log(`  ${date}: 전체 ${totalUsers}명, 22시 이후 ${lateUsers}명 (${lateRatio}%)`);
  });
  
  // 리마인더 전/후 날짜 구분
  const beforeDates = Object.keys(submissionsByDate).filter(date => date <= reminderEndDate);
  const afterDates = Object.keys(submissionsByDate).filter(date => date >= reminderStartDate);
  
  console.log(`[리마인더 효과 분석] 리마인더 전 날짜 수: ${beforeDates.length}일`);
  console.log(`[리마인더 효과 분석] 리마인더 후 날짜 수: ${afterDates.length}일`);
  
  // 리마인더 전/후 22시 이후 인증 비율 계산
  let beforeTotalUsers = 0;    // 리마인더 전 총 인증 인원 수 (날짜별 합산)
  let beforeLateUsers = 0;     // 리마인더 전 22시 이후 인증 인원 수 (날짜별 합산)
  let beforeDailyRatios = [];  // 리마인더 전 날짜별 22시 이후 인증 비율
  
  beforeDates.forEach(date => {
    const dayData = submissionsByDate[date];
    const dayTotalUsers = dayData.allUsers.size;
    const dayLateUsers = dayData.lateUsers.size;
    
    beforeTotalUsers += dayTotalUsers;
    beforeLateUsers += dayLateUsers;
    
    // 날짜별 비율 추가 (인증자가 있는 날만)
    if (dayTotalUsers > 0) {
      beforeDailyRatios.push((dayLateUsers / dayTotalUsers) * 100);
    }
  });
  
  let afterTotalUsers = 0;     // 리마인더 후 총 인증 인원 수 (날짜별 합산)
  let afterLateUsers = 0;      // 리마인더 후 22시 이후 인증 인원 수 (날짜별 합산)
  let afterDailyRatios = [];   // 리마인더 후 날짜별 22시 이후 인증 비율
  
  afterDates.forEach(date => {
    const dayData = submissionsByDate[date];
    const dayTotalUsers = dayData.allUsers.size;
    const dayLateUsers = dayData.lateUsers.size;
    
    afterTotalUsers += dayTotalUsers;
    afterLateUsers += dayLateUsers;
    
    // 날짜별 비율 추가 (인증자가 있는 날만)
    if (dayTotalUsers > 0) {
      afterDailyRatios.push((dayLateUsers / dayTotalUsers) * 100);
    }
  });
  
  // 날짜별 평균 비율 계산
  const beforeAverageRatio = beforeDailyRatios.length > 0 
    ? parseFloat((beforeDailyRatios.reduce((a, b) => a + b, 0) / beforeDailyRatios.length).toFixed(1))
    : 0;
  
  const afterAverageRatio = afterDailyRatios.length > 0
    ? parseFloat((afterDailyRatios.reduce((a, b) => a + b, 0) / afterDailyRatios.length).toFixed(1))
    : 0;
  
  // 전체 비율 계산 (대안적 지표)
  const beforeTotalRatio = beforeTotalUsers > 0
    ? parseFloat(((beforeLateUsers / beforeTotalUsers) * 100).toFixed(1))
    : 0;
  
  const afterTotalRatio = afterTotalUsers > 0
    ? parseFloat(((afterLateUsers / afterTotalUsers) * 100).toFixed(1))
    : 0;
  
  console.log(`[리마인더 효과 분석] 리마인더 전: 총 ${beforeTotalUsers}명 중 ${beforeLateUsers}명 22시 이후 인증`);
  console.log(`[리마인더 효과 분석] 리마인더 전: 날짜별 평균 비율 ${beforeAverageRatio}%, 전체 평균 비율 ${beforeTotalRatio}%`);
  console.log(`[리마인더 효과 분석] 리마인더 후: 총 ${afterTotalUsers}명 중 ${afterLateUsers}명 22시 이후 인증`);
  console.log(`[리마인더 효과 분석] 리마인더 후: 날짜별 평균 비율 ${afterAverageRatio}%, 전체 평균 비율 ${afterTotalRatio}%`);
  
  // 날짜별 평균 비율 기준 차이
  const averageDifference = parseFloat((afterAverageRatio - beforeAverageRatio).toFixed(1));
  console.log(`[리마인더 효과 분석] 날짜별 평균 비율 차이: ${averageDifference}%p`);
  
  // 전체 비율 기준 차이
  const totalDifference = parseFloat((afterTotalRatio - beforeTotalRatio).toFixed(1));
  console.log(`[리마인더 효과 분석] 전체 비율 차이: ${totalDifference}%p`);
  
  console.log('========== 리마인더 효과 분석 종료 ==========');
  
  // 날짜별 평균 비율 기준으로 결과 반환
  return {
    labels: ['리마인더 전', '리마인더 후'],
    beforeReminder: beforeAverageRatio,
    afterReminder: afterAverageRatio,
    data: [beforeAverageRatio, afterAverageRatio],
    beforeCount: beforeLateUsers,
    beforeTotal: beforeTotalUsers,
    afterCount: afterLateUsers,
    afterTotal: afterTotalUsers,
    difference: averageDifference
  };
} 