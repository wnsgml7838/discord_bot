// API 엔드포인트: 백준 문제 추천
import { exec } from 'child_process';
import path from 'path';
import { createHash } from 'crypto';

// Discord Webhook URL 설정
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Solved.ac API 엔드포인트
const SOLVED_API_BASE = "https://solved.ac/api";
const USER_INFO_ENDPOINT = `${SOLVED_API_BASE}/v3/user/show`;
const PROBLEM_SEARCH_ENDPOINT = `${SOLVED_API_BASE}/v3/search/problem`;

/**
 * 서버 측에서 활동을 로깅하는 함수
 * @param {string} event - 이벤트 이름
 * @param {Object} metadata - 추가 메타데이터
 * @param {Object} req - HTTP 요청 객체
 */
async function logServerActivity(event, metadata, req) {
  try {
    // 요청자 IP 해시화 (개인정보 보호)
    const userIpHash = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const hashedIp = createHash('sha256').update(userIpHash || 'unknown').digest('hex').substring(0, 10);

    // Discord에 전송할 메시지 구성
    const message = {
      embeds: [{
        title: `📊 백준 API 호출: ${event}`,
        color: 0x00AAFF, // 파란색
        fields: [
          { name: '이벤트', value: event, inline: true },
          { name: '시간', value: new Date().toISOString(), inline: true },
          { name: '해시된 IP', value: hashedIp, inline: true },
          { name: 'User Agent', value: req.headers['user-agent'] || 'Unknown', inline: false }
        ],
        footer: { text: 'Vercel 백준 API 활동 로그' },
        timestamp: new Date().toISOString()
      }]
    };

    // 추가 메타데이터가 있는 경우 필드에 추가
    if (metadata) {
      message.embeds[0].fields.push({
        name: '추가 데이터',
        value: '```json\n' + JSON.stringify(metadata, null, 2) + '\n```',
        inline: false
      });
    }

    // Discord Webhook URL이 설정되어 있는지 확인
    if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('YOUR_WEBHOOK')) {
      console.log('Discord Webhook URL is not configured. API log:', message);
      return;
    }

    // Discord Webhook으로 메시지 전송
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  } catch (error) {
    console.error('로깅 실패:', error);
  }
}

/**
 * 티어 이름 가져오기 (1~30 -> 브론즈 5 ~ 루비 1)
 * @param {number} tier - 티어 번호 (1-30)
 * @returns {string} - 티어 이름
 */
function getTierNameKo(tier) {
  const tierColors = ["브론즈", "실버", "골드", "플래티넘", "다이아몬드", "루비"];
  const tierLevels = ["5", "4", "3", "2", "1"];
  
  if (tier === 0) {
    return "언레이티드";
  }
  
  const colorIdx = Math.floor((tier - 1) / 5);
  const levelIdx = 4 - ((tier - 1) % 5);
  
  if (colorIdx >= tierColors.length) {
    return "마스터";
  }
  
  return `${tierColors[colorIdx]} ${tierLevels[levelIdx]}`;
}

/**
 * 티어 색상 가져오기
 * @param {number} tier - 티어 번호 (1-30)
 * @returns {string} - 색상 코드
 */
function getTierColor(tier) {
  if (tier <= 0) return "#000000"; // Unrated
  
  const tierColors = [
    "#ad5600", // Bronze
    "#435f7a", // Silver
    "#ec9a00", // Gold
    "#27e2a4", // Platinum
    "#00b4fc", // Diamond
    "#ff0062"  // Ruby
  ];
  
  const colorIdx = Math.floor((tier - 1) / 5);
  return colorIdx < tierColors.length ? tierColors[colorIdx] : "#000000";
}

/**
 * 사용자 정보 가져오기
 * @param {string} handle - 백준 ID
 * @returns {Object|null} - 사용자 정보
 */
async function getUserInfo(handle) {
  try {
    const response = await fetch(`${USER_INFO_ENDPOINT}?handle=${handle}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { error: "사용자를 찾을 수 없습니다." };
      }
      return { error: `API 오류: ${response.status}` };
    }
    
    const data = await response.json();
    
    // 필요한 정보만 추출
    return {
      handle: data.handle,
      tier: data.tier || 0,
      solvedCount: data.solvedCount || 0,
      tierName: getTierNameKo(data.tier || 0),
      tierColor: getTierColor(data.tier || 0)
    };
  } catch (error) {
    console.error('사용자 정보 가져오기 오류:', error);
    return { error: error.message };
  }
}

/**
 * 문제 검색하기
 * @param {Object} params - 검색 파라미터
 * @returns {Array|null} - 문제 목록
 */
async function searchProblems(params) {
  try {
    // 쿼리 파라미터 생성
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, value);
    }
    
    const response = await fetch(`${PROBLEM_SEARCH_ENDPOINT}?${queryParams.toString()}`);
    
    if (!response.ok) {
      return { error: `API 오류: ${response.status}` };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('문제 검색 오류:', error);
    return { error: error.message };
  }
}

/**
 * 사용자에게 적합한 문제 추천하기
 * @param {string} handle - 백준 ID
 * @param {number} page - 페이지 번호
 * @returns {Object} - 추천 결과
 */
async function recommendProblems(handle, page = 1) {
  try {
    // 1. 사용자 정보 가져오기
    const userInfo = await getUserInfo(handle);
    
    if (userInfo.error) {
      return { error: userInfo.error };
    }
    
    // 2. 사용자 티어에 맞는 문제 검색 (티어 기반)
    let minLevel = Math.max(1, userInfo.tier - 5);
    let maxLevel = Math.min(30, userInfo.tier + 5);
    
    // 티어가 낮은 경우 상향 조정
    if (userInfo.tier < 6) {
      minLevel = 1;
      maxLevel = 10;
    }
    
    // 3. 먼저 사용자가 풀지 않은 문제 중 적절한 티어의 문제 검색
    let params = {
      query: `solved_by:!${handle} tier:${minLevel}..${maxLevel}`,
      page: page,
      sort: "random",
      direction: "asc",
      limit: 5
    };
    
    let searchResult = await searchProblems(params);
    
    // 결과가 없거나 오류가 있는 경우
    if (searchResult.error || !searchResult.items || searchResult.items.length === 0) {
      console.log('첫 번째 검색 실패, 더 넓은 범위로 검색합니다...');
      
      // 4. 티어 범위를 더 넓게 설정
      minLevel = Math.max(1, userInfo.tier - 10);
      maxLevel = Math.min(30, userInfo.tier + 10);
      
      params = {
        query: `solved_by:!${handle} tier:${minLevel}..${maxLevel}`,
        page: page,
        sort: "random",
        direction: "asc",
        limit: 5
      };
      
      searchResult = await searchProblems(params);
      
      // 여전히 결과가 없는 경우
      if (searchResult.error || !searchResult.items || searchResult.items.length === 0) {
        console.log('두 번째 검색 실패, 인기 있는 문제를 검색합니다...');
        
        // 5. 인기 있는 문제 검색 (풀이 수로 정렬)
        params = {
          query: `solved_by:!${handle}`,
          page: page,
          sort: "solved",
          direction: "desc",
          limit: 5
        };
        
        searchResult = await searchProblems(params);
      }
    }
    
    // 최종적으로도 결과가 없는 경우
    if (searchResult.error || !searchResult.items || searchResult.items.length === 0) {
      return { 
        error: "현재 조건에 맞는 추천 문제를 찾을 수 없습니다.",
        userInfo
      };
    }
    
    // 6. 추천 문제 형식화
    const recommendations = formatRecommendations(searchResult.items, userInfo);
    
    return {
      userInfo,
      recommendations,
      page
    };
  } catch (error) {
    console.error('문제 추천 오류:', error);
    return { error: error.message };
  }
}

/**
 * 추천 문제 형식화하기
 * @param {Array} problems - 문제 목록
 * @param {Object} userInfo - 사용자 정보
 * @returns {Array} - 형식화된 추천 문제 목록
 */
function formatRecommendations(problems, userInfo) {
  return problems.map((problem, index) => ({
    id: problem.problemId,
    title: problem.titleKo,
    level: problem.level,
    tierName: getTierNameKo(problem.level),
    tierColor: getTierColor(problem.level),
    tags: problem.tags.map(tag => tag.displayNames.find(n => n.language === "ko")?.name || tag.key),
    acceptedUserCount: problem.acceptedUserCount,
    averageTries: problem.averageTries,
    score: Math.round(90 - Math.abs(userInfo.tier - problem.level) * 2 + Math.random() * 10)
  }));
}

/**
 * 추천 결과 HTML 생성
 * @param {Object} result - 추천 결과
 * @returns {string} - HTML
 */
function generateRecommendHTML(result) {
  // 에러가 있는 경우
  if (result.error) {
    return `
      <h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제</h2>
      <div class='border-t-4 border-black my-3'></div>
      <div class='p-2 mb-4 bg-red-100 rounded-md text-black'>
        <p class='font-bold mb-1'>⚠️ 오류 발생</p>
        <p>${result.error}</p>
      </div>
      <div class='py-4 text-black font-black bg-red-200 p-2 rounded-md'>추천 문제를 찾을 수 없습니다.</div>
    `;
  }
  
  const { userInfo, recommendations, page } = result;
  
  // HTML 헤더 생성
  let html = `
    <h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제</h2>
    <div class='border-t-4 border-black my-3'></div>
    <div class='p-2 mb-4 bg-blue-100 rounded-md text-black'>
      <p class='font-bold mb-1'>사용자 정보:</p>
      <p>백준 ID: ${userInfo.handle}</p>
      <p>사용자 티어: ${userInfo.tierName}</p>
      <p>해결한 문제 수: ${userInfo.solvedCount}개</p>
      <p>페이지: ${page}</p>
    </div>
    <div class='py-2 mb-4 bg-yellow-100 text-black rounded-md p-2'>
      <p class='font-bold'>추천 방식: 티어 기반 추천</p>
      <p>사용자의 티어에 맞는 문제를 추천합니다.</p>
    </div>
  `;
  
  // 추천 결과가 없는 경우
  if (recommendations.length === 0) {
    html += `
      <div class='py-4 text-black font-black bg-red-200 p-2 rounded-md'>현재 조건에 맞는 추천 문제를 찾을 수 없습니다.</div>
    `;
  } else {
    // 각 문제 카드 생성
    recommendations.forEach((problem, index) => {
      html += `
        <div class='problem-card mb-4 p-4 rounded-lg bg-white shadow-md border border-gray-300'>
          <div class='flex justify-between items-start'>
            <h3 class='text-lg font-medium text-gray-800'>
              <span class='inline-block mr-2 px-2 py-1 rounded-md text-white text-sm font-medium' style='background-color: ${problem.tierColor};'>${problem.tierName}</span>
              ${index + 1}. ${problem.title} <span class='text-gray-600 font-normal'>#${problem.id}</span>
            </h3>
            <span class='text-lg font-medium text-gray-700'>${problem.score}점</span>
          </div>
          
          <div class='mt-1 text-sm text-gray-600'>
            <span>푼 사람 수: ${problem.acceptedUserCount || 0}명</span>
            <span class='ml-3'>평균 시도: ${problem.averageTries?.toFixed(1) || '정보 없음'}</span>
          </div>
          
          <div class='mt-2'>
            <span class='text-gray-700'>태그:</span>
            ${problem.tags.map(tag => `<span class='inline-block mr-1 px-2 py-0.5 bg-blue-600 rounded-md text-sm text-white'>${tag}</span>`).join('')}
          </div>
          
          <div class='mt-3'>
            <a href='https://boj.kr/${problem.id}' target='_blank' class='inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors'>
              <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />
              </svg>
              문제 풀기
            </a>
          </div>
        </div>
      `;
    });
  }
  
  // 페이지 네비게이션 안내
  html += `
    <div class='py-3 bg-gray-100 rounded-md p-4 text-center'>
      <p class='font-medium text-gray-800 mb-2'>페이지 ${page} 표시 중</p>
      <p class='text-sm text-gray-600'>더 많은 문제를 보려면 페이지 버튼을 클릭하세요.</p>
    </div>
  `;
  
  return html;
}

/**
 * 백준 문제 추천 API 핸들러
 * @param {object} req - HTTP 요청 객체
 * @param {object} res - HTTP 응답 객체
 */
export default async function handler(req, res) {
  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메소드입니다.' });
  }

  try {
    const { handle, page = 1 } = req.body;

    // 필수 파라미터 검증
    if (!handle) {
      await logServerActivity('baekjoon_api_error', { error: '백준 ID 누락', method: req.method }, req);
      return res.status(400).json({ error: '백준 ID는 필수입니다.' });
    }

    // 페이지 번호 검증
    const pageNum = parseInt(page, 10) || 1;
    if (pageNum < 1) {
      await logServerActivity('baekjoon_api_error', { error: '유효하지 않은 페이지', handle, page }, req);
      return res.status(400).json({ error: '유효하지 않은 페이지 번호입니다.' });
    }

    // API 호출 로깅
    await logServerActivity('baekjoon_api_call', { handle, page: pageNum }, req);

    console.log(`백준 문제 추천 시작: ${handle}, 페이지: ${pageNum}`);
    
    // solved.ac API 직접 호출하여 문제 추천
    const result = await recommendProblems(handle, pageNum);
    
    // 결과 HTML 생성
    const htmlResult = generateRecommendHTML(result);
    
    // 결과 로깅
    await logServerActivity('baekjoon_api_result', { 
      handle, 
      page: pageNum,
      user_tier: result.userInfo?.tierName || '정보 없음',
      has_error: !!result.error
    }, req);
    
    return res.status(200).json({ 
      success: true, 
      result: htmlResult,
      userInfo: result.userInfo || { handle, tier: '정보 없음' },
      page: pageNum
    });
  } catch (error) {
    console.error('백준 문제 추천 처리 중 예외 발생:', error);
    
    // 예외 로깅
    await logServerActivity('baekjoon_api_exception', { 
      error: error.message,
      stack: error.stack
    }, req);
    
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
} 