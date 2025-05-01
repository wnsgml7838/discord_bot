// API 엔드포인트: 백준 문제 추천
import { exec } from 'child_process';
import path from 'path';
import { createHash } from 'crypto';

// Discord Webhook URL 설정
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

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
    
    // 스크립트 경로
    const scriptPath = path.join(process.cwd(), 'bot', 'commands', 'baekjoon_recommender.py');
    
    console.log(`백준 문제 추천 시작: ${handle}, 페이지: ${pageNum}`);
    console.log(`실행 경로: python ${scriptPath} ${handle} ${pageNum}`);

    // Python 스크립트 실행
    exec(`python ${scriptPath} ${handle} ${pageNum}`, {
      timeout: 30000 // 30초 타임아웃
    }, async (error, stdout, stderr) => {
      if (error) {
        console.error('백준 문제 추천 오류:', error.message);
        console.error('STDERR:', stderr);
        
        // 오류 로깅
        await logServerActivity('baekjoon_api_exec_error', { 
          handle, 
          page: pageNum,
          error: error.message,
          stderr
        }, req);
        
        // 오류가 발생하면 예시 응답을 대신 반환 (오류 발생 표시와 함께)
        const userTier = "정보 없음";
        const result = generateExampleResponse(handle, pageNum, true);
        
        await logServerActivity('baekjoon_api_fallback', { 
          handle, 
          page: pageNum,
          error: error.message
        }, req);
        
        return res.status(200).json({ 
          success: true,
          is_fallback: true,
          result: result,
          userInfo: {
            handle,
            tier: userTier
          },
          page: pageNum,
          error: error.message
        });
      }
      
      if (stderr) {
        console.warn('백준 문제 추천 경고:', stderr);
      }
      
      console.log('백준 문제 추천 완료');
      
      // stdout에서 HTML 결과 부분만 추출
      // 시작 표시: <h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제
      // 또는 시작부터 끝까지의 출력이 HTML 결과일 수 있음
      let result = stdout;
      let noResults = false;
      
      // HTML 시작 부분을 찾습니다
      const htmlStartIndex = stdout.indexOf("<h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제");
      
      if (htmlStartIndex !== -1) {
        // HTML 부분만 추출합니다
        result = stdout.substring(htmlStartIndex);
      } else if (stdout.includes("현재 조건에 맞는 추천 문제를 찾을 수 없습니다")) {
        // 결과가 없는 경우 기본 메시지 생성
        result = `<h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제</h2>
                  <div class='border-t-4 border-black my-3'></div>
                  <div class='py-4 text-black font-black bg-red-200 p-2 rounded-md'>현재 조건에 맞는 추천 문제를 찾을 수 없습니다.</div>`;
        noResults = true;
      }
      
      // 사용자 정보 추출 (있는 경우)
      let userTier = "정보 없음";
      const tierMatch = stdout.match(/사용자 티어: (.+)/);
      if (tierMatch && tierMatch[1]) {
        userTier = tierMatch[1];
      }
      
      // 결과 로깅
      await logServerActivity('baekjoon_api_result', { 
        handle, 
        page: pageNum,
        user_tier: userTier,
        no_results: noResults
      }, req);
      
      return res.status(200).json({ 
        success: true, 
        result: result,
        userInfo: {
          handle,
          tier: userTier
        },
        page: pageNum
      });
    });
    
    /* 
    // Vercel 환경에서는 Python 스크립트 실행이 불가능하므로 하드코딩된 예시 응답 반환
    const userTier = "골드 4"; // 예시 티어
    
    // 예시 HTML 응답 생성
    const result = generateExampleResponse(handle, pageNum);
    
    // 결과 로깅
    await logServerActivity('baekjoon_api_result', { 
      handle, 
      page: pageNum,
      user_tier: userTier,
      is_example: true
    }, req);
    
    return res.status(200).json({ 
      success: true, 
      result: result,
      userInfo: {
        handle,
        tier: userTier
      },
      page: pageNum
    });
    */
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

/**
 * 예시 응답 HTML 생성 함수
 * @param {string} handle - 백준 ID
 * @param {number} page - 페이지 번호
 * @param {boolean} isError - 오류 발생 여부
 * @returns {string} - HTML 응답
 */
function generateExampleResponse(handle, page, isError = false) {
  // 예시 문제 데이터
  const exampleProblems = [
    {
      id: 1000,
      title: "A+B",
      level: 1,
      tags: ["수학", "구현", "사칙연산"],
      score: 95,
      tierName: "브론즈 5",
      tierColor: "#ad5600",
      difficulty: 90,
      tag_similarity: 85,
      popularity: 100,
      solved_count: 12345
    },
    {
      id: 1001,
      title: "A-B",
      level: 2,
      tags: ["수학", "구현", "사칙연산"],
      score: 92,
      tierName: "브론즈 4",
      tierColor: "#ad5600",
      difficulty: 85,
      tag_similarity: 80,
      popularity: 98,
      solved_count: 10234
    },
    {
      id: 2557,
      title: "Hello World",
      level: 1,
      tags: ["구현"],
      score: 90,
      tierName: "브론즈 5",
      tierColor: "#ad5600",
      difficulty: 95,
      tag_similarity: 70,
      popularity: 100,
      solved_count: 15678
    }
  ];
  
  // 추가 페이지에 대한 다른 예시 문제
  const page2Problems = [
    {
      id: 2438,
      title: "별 찍기 - 1",
      level: 3,
      tags: ["구현"],
      score: 88,
      tierName: "브론즈 3",
      tierColor: "#ad5600",
      difficulty: 80,
      tag_similarity: 75,
      popularity: 95,
      solved_count: 9876
    },
    {
      id: 2439,
      title: "별 찍기 - 2",
      level: 3,
      tags: ["구현"],
      score: 87,
      tierName: "브론즈 3",
      tierColor: "#ad5600",
      difficulty: 78,
      tag_similarity: 76,
      popularity: 94,
      solved_count: 9645
    },
    {
      id: 10171,
      title: "고양이",
      level: 1,
      tags: ["구현"],
      score: 86,
      tierName: "브론즈 5",
      tierColor: "#ad5600",
      difficulty: 98,
      tag_similarity: 68,
      popularity: 96,
      solved_count: 8765
    }
  ];
  
  // 선택한 페이지에 따라 다른 문제 표시
  const problems = page === 1 ? exampleProblems : page2Problems;
  
  // HTML 헤더 생성
  let html = `
    <h2 class='text-3xl font-black text-black bg-yellow-200 p-2 rounded-md'>📋 추천 문제</h2>
    <div class='border-t-4 border-black my-3'></div>
  `;
  
  // 오류 발생 시 알림 추가
  if (isError) {
    html += `
    <div class='p-2 mb-4 bg-red-100 rounded-md text-black'>
      <p class='font-bold mb-1'>⚠️ 오류 발생</p>
      <p>Python 스크립트 실행 중 오류가 발생하여 예시 데이터를 표시합니다.</p>
    </div>
    `;
  }
  
  html += `
    <div class='p-2 mb-4 bg-blue-100 rounded-md text-black'>
      <p class='font-bold mb-1'>사용자 정보:</p>
      <p>백준 ID: ${handle}</p>
      <p>사용자 티어: ${isError ? "정보 없음" : "골드 4"} ${isError ? "" : "(Vercel 환경 예시)"}</p>
      <p>페이지: ${page}</p>
      ${isError ? "" : "<p class='mt-2 text-xs text-gray-600'>※ Vercel 환경에서는 Python 스크립트를 실행할 수 없어 예시 데이터를 표시합니다.</p>"}
    </div>
    <div class='py-2 mb-4 bg-yellow-100 text-black rounded-md p-2'>
      <p class='font-bold'>추천 방식: 태그 기반 추천</p>
      <p>사용자의 풀이 패턴을 분석하여 맞춤형 문제를 추천합니다.</p>
    </div>
  `;
  
  // 각 문제 카드 생성
  problems.forEach((problem, index) => {
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
          <span>푼 사람 수: ${problem.solved_count}명</span>
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
        
        <div class='mt-3 text-sm text-gray-600'>
          <div class='grid grid-cols-3 gap-2'>
            <div>난이도 적합도: <span class='font-medium'>${problem.difficulty}</span></div>
            <div>태그 유사도: <span class='font-medium'>${problem.tag_similarity}</span></div>
            <div>인기도: <span class='font-medium'>${problem.popularity}</span></div>
          </div>
        </div>
      </div>
    `;
  });
  
  // 페이지 네비게이션 안내
  html += `
    <div class='py-3 bg-gray-100 rounded-md p-4 text-center'>
      <p class='font-medium text-gray-800 mb-2'>페이지 ${page} 표시 중</p>
      <p class='text-sm text-gray-600'>더 많은 문제를 보려면 페이지 버튼을 클릭하세요.</p>
    </div>
  `;
  
  return html;
} 