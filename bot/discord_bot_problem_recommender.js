/**
 * 백준 문제 추천 기능 - Discord 봇 연동
 * 백준 문제를 추천하는 자바스크립트 구현
 */

// node-fetch v3는 ESM 모듈이므로 CommonJS에서 직접 사용 불가능
// 크로스 버전 호환을 위해 동적 import 처리
let fetch;
(async () => {
  try {
    const module = await import('node-fetch');
    fetch = module.default;
  } catch (error) {
    // fallback - node-fetch@2.x 버전이 설치되어 있는 경우
    try {
      fetch = require('node-fetch');
    } catch (err) {
      console.error('node-fetch 모듈을 가져올 수 없습니다:', err);
      // polyfill 또는 기본 fetch 함수 (Node.js 18 이상)
      fetch = global.fetch || (() => {
        throw new Error('fetch 함수를 사용할 수 없습니다. Node.js 18 이상을 사용하거나 node-fetch를 설치하세요.');
      });
    }
  }
})();

// cheerio 로드
let cheerio;
try {
  cheerio = require('cheerio');
} catch (error) {
  console.warn('cheerio 모듈을 가져올 수 없습니다:', error);
  // cheerio가 없어도 기본 동작은 가능하도록 빈 객체 제공
  cheerio = { load: () => ({ find: () => ({ text: () => '' }) }) };
}

/**
 * 백준 아이디로 문제 추천 
 * @param {string} handle - 백준 아이디
 * @param {number} page - 페이지 번호 (기본값: 1)
 * @returns {Promise<string>} - 추천 결과 메시지 (HTML 형식)
 */
async function recommendBaekjoonProblems(handle, page = 1) {
  // 문자열로 들어온 페이지 번호를 정수로 변환
  if (typeof page === 'string') {
    page = parseInt(page) || 1;
  }
  
  console.log(`🔍 '${handle}'님의 백준 문제 추천을 시작합니다... (페이지: ${page})`);
  
  try {
    // 1. 사용자 정보 가져오기
    const userInfo = await getUserInfo(handle);
    if (!userInfo) {
      return "사용자 정보를 가져올 수 없습니다. 백준 아이디를 확인해주세요.";
    }
    
    console.log(`사용자 티어: ${getTierNameKo(userInfo.tier)}`);
    console.log(`사용자 레이팅: ${userInfo.rating}`);
    
    // 2. 사용자의 해결한 문제 가져오기
    const solvedProblems = await getSolvedProblems(handle);
    if (!solvedProblems || solvedProblems.length === 0) {
      return "해결한 문제가 없습니다. 문제를 풀고 다시 시도해주세요.";
    }
    
    // 3. 사용자의 문제 해결 데이터 가져오기
    const solvedProblemsWithDetails = await getProblemDetails(solvedProblems);
    
    // 4. 태그별 티어 계산
    const { tagTiers, allTagTier } = calculateTagTiers(solvedProblemsWithDetails);
    
    // 태그별 티어 정보 출력
    console.log(`태그별 티어 계산 결과:`);
    Object.entries(tagTiers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([tag, tier]) => {
        console.log(`- ${tag}: ${getTierNameKo(tier)}`);
      });
    console.log(`전체 태그 평균 티어: ${getTierNameKo(allTagTier)}`);
    
    // 5. 최종 추천 티어 계산
    const averageTier = calculateAverageTier(userInfo, allTagTier);
    console.log(`최종 추천 티어: ${getTierNameKo(averageTier)}`);
    
    const totalRecommendationsNeeded = 5; // 총 추천할 문제 수
    
    // 6. 태그 기반 문제 추천 (최대 2개)
    const tagBasedProblems = await recommendTagBasedProblems(averageTier, solvedProblems, solvedProblemsWithDetails, page);
    const tagCount = tagBasedProblems.length;
    console.log(`태그 기반 추천 문제 수: ${tagCount}`);
    
    // 7. 인기도 기반 문제 추천 (나머지)
    // 태그 기반 문제 수에 따라 인기도 문제 개수 결정 (항상 총 5개가 되도록)
    const popularityCount = totalRecommendationsNeeded - tagCount;
    console.log(`인기도 기반 문제 추천 수 결정: ${popularityCount}개`);
    
    const popularityBasedProblems = await recommendPopularityBasedProblems(averageTier, solvedProblems, solvedProblemsWithDetails, page, popularityCount);
    const finalPopularityCount = popularityBasedProblems.length;
    console.log(`인기도 기반 추천 문제 수: ${finalPopularityCount}`);
    
    // 8. 최종 추천 문제 목록 생성
    let recommendedProblems = [...tagBasedProblems, ...popularityBasedProblems];
    
    // 8-1. 문제 개수가 5개 미만인 경우 추가로 인기도 기반 문제 추천
    if (recommendedProblems.length < totalRecommendationsNeeded) {
      const additionalCount = totalRecommendationsNeeded - recommendedProblems.length;
      console.log(`문제 개수가 부족합니다. 추가로 ${additionalCount}개의 인기도 기반 문제를 추천합니다.`);
      
      // 이미 추천된 문제 ID 목록 (제외할 목록)
      const excludedProblemIds = new Set([
        ...solvedProblems.map(id => +id), // 이미 해결한 문제 (숫자형으로 변환)
        ...recommendedProblems.map(p => +p.id) // 이미 추천된 문제 (숫자형으로 변환)
      ]);
      
      console.log(`제외할 문제 ID 수: ${excludedProblemIds.size}`);
      
      // 다음 페이지부터 추가 문제 검색
      let additionalPage = page + 1;
      let additionalProblems = [];
      
      // 필요한 개수를 채울 때까지 최대 5페이지까지 추가 검색 (이전에는 3페이지)
      while (additionalProblems.length < additionalCount && additionalPage < page + 6) {
        console.log(`추가 문제 검색 중: 페이지 ${additionalPage}, 현재까지 ${additionalProblems.length}개 추가됨`);
        
        const addedProblems = await recommendAdditionalPopularityProblems(
          averageTier, 
          excludedProblemIds, 
          additionalPage, 
          additionalCount
        );
        
        console.log(`페이지 ${additionalPage}에서 ${addedProblems.length}개 문제 추가 발견`);
        
        if (addedProblems.length === 0) {
          // 더 이상 추천할 문제가 없으면 중단
          console.log(`페이지 ${additionalPage}에서 더 이상 추천할 문제가 없어 검색 중단`);
          break;
        }
        
        additionalProblems = [...additionalProblems, ...addedProblems];
        // 필요한 개수만 남기기
        additionalProblems = additionalProblems.slice(0, additionalCount);
        additionalPage++;
      }
      
      console.log(`추가 인기도 기반 추천 문제 수: ${additionalProblems.length}`);
      if (additionalProblems.length > 0) {
        console.log(`추가된 문제 ID: ${additionalProblems.map(p => p.id).join(', ')}`);
      }
      
      // 추가 문제 병합
      recommendedProblems = [...recommendedProblems, ...additionalProblems];
    }
    
    // 9. 문제를 티어 기준으로 정렬 (오름차순 - 낮은 티어/쉬운 문제가 먼저 나오도록)
    recommendedProblems.forEach(problem => {
      problem.levelInt = parseInt(problem.level);
    });
    
    recommendedProblems.sort((a, b) => a.levelInt - b.levelInt);
    
    // 10. 결과 출력
    const result = formatRecommendations(recommendedProblems, averageTier);
    
    // 최종 추천 수가 5개 미만일 경우 추가 메시지
    const totalRecommended = recommendedProblems.length;
    if (totalRecommended < totalRecommendationsNeeded) {
      console.log(`경고: 추천 문제가 ${totalRecommended}개로, 목표인 ${totalRecommendationsNeeded}개보다 적습니다.`);
    }
    
    // 11. 안내 메시지 추가
    const finalTagCount = tagBasedProblems.length;
    const finalPopCount = recommendedProblems.length - finalTagCount;
    
    let recommendationMsg;
    if (finalTagCount === 0) {
      recommendationMsg = `인기도 기반으로 ${finalPopCount}개의 문제를 추천합니다.`;
    } else {
      recommendationMsg = `태그 기반으로 ${finalTagCount}개, 인기도 기반으로 ${finalPopCount}개의 문제를 추천합니다.`;
    }
    
    const explanation = `
🎯 추천 방식:
1️⃣ 태그 기반: 사용자가 가장 많이 푼 태그의 문제를 추천합니다. 실력에 맞는 적절한 난이도의 문제를 제안합니다.
2️⃣ 인기도 기반: 많은 사용자들이 푼 인기 있는 문제를 추천합니다. 백준 문제 풀이에 도움이 되는 기본적인 문제들입니다.

💡 티어 정보: 사용자 티어는 ${getTierNameKo(userInfo.tier)}(레이팅: ${userInfo.rating})이며, 
  추천 티어는 ${getTierNameKo(averageTier)}로 계산되었습니다.
  
📊 총 ${solvedProblems.length}개의 문제를 분석했으며, ${recommendationMsg}
📄 현재 페이지: ${page}
`;
    
    // 결과에 설명 추가
    const finalResult = result + `\n<div class='mt-8 p-6 bg-yellow-100 rounded-lg text-xl text-black font-black border-2 border-black'>${explanation}</div>`;
    
    return finalResult;
  } catch (error) {
    console.error("백준 문제 추천 중 오류 발생:", error);
    return "문제 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

/**
 * 사용자 정보 가져오기
 * @param {string} handle - 백준 아이디
 * @returns {Promise<Object>} - 사용자 정보
 */
async function getUserInfo(handle) {
  try {
    const response = await fetch(`https://solved.ac/api/v3/user/show?handle=${handle}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      handle: data.handle,
      tier: data.tier,
      rating: data.rating
    };
  } catch (error) {
    console.error("사용자 정보 가져오기 실패:", error);
    return null;
  }
}

/**
 * 사용자가 해결한 문제 가져오기
 * @param {string} handle - 백준 아이디
 * @returns {Promise<Array>} - 해결한 문제 번호 배열
 */
async function getSolvedProblems(handle) {
  try {
    const solvedProblems = [];
    let page = 1;
    let hasMoreData = true;
    
    while (hasMoreData) {
      const response = await fetch(`https://solved.ac/api/v3/search/problem?query=solved_by:${handle}&page=${page}`);
      if (!response.ok) {
        break;
      }
      
      const data = await response.json();
      const { items, count } = data;
      
      if (items.length === 0) {
        hasMoreData = false;
        break;
      }
      
      items.forEach(item => {
        solvedProblems.push(item.problemId);
      });
      
      // 다음 페이지가 있는지 확인
      const totalPages = Math.ceil(count / 100);
      if (page >= totalPages) {
        hasMoreData = false;
      }
      
      page++;
      
      // 너무 많은 요청을 방지하기 위한 제한 (최대 10페이지)
      if (page > 10) {
        hasMoreData = false;
      }
    }
    
    return solvedProblems;
  } catch (error) {
    console.error("해결한 문제 가져오기 실패:", error);
    return [];
  }
}

/**
 * 문제 상세 정보 가져오기
 * @param {Array} problemIds - 문제 ID 배열
 * @returns {Promise<Array>} - 문제 상세 정보 배열
 */
async function getProblemDetails(problemIds) {
  try {
    const problemDetails = [];
    
    // 50개씩 나누어 요청
    const chunks = chunkArray(problemIds, 50);
    
    for (const chunk of chunks) {
      const problemIdString = chunk.join(',');
      const response = await fetch(`https://solved.ac/api/v3/problem/lookup?problemIds=${problemIdString}`);
      
      if (!response.ok) {
        continue;
      }
      
      const data = await response.json();
      problemDetails.push(...data);
    }
    
    return problemDetails;
  } catch (error) {
    console.error("문제 상세 정보 가져오기 실패:", error);
    return [];
  }
}

/**
 * 배열을 지정된 크기의 청크로 나누기
 * @param {Array} array - 원본 배열
 * @param {number} size - 청크 크기
 * @returns {Array} - 청크 배열
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 태그별 티어 계산
 * @param {Array} solvedProblemsWithDetails - 문제 상세 정보 배열
 * @returns {Object} - 태그별 티어 정보
 */
function calculateTagTiers(solvedProblemsWithDetails) {
  const tagCounts = {};
  const tagTiers = {};
  const tagTierSum = {};
  
  solvedProblemsWithDetails.forEach(problem => {
    if (!problem.tags || problem.tags.length === 0) {
      return;
    }
    
    problem.tags.forEach(tag => {
      const tagName = tag.displayNames.find(name => name.language === 'ko')?.name || 
                     tag.displayNames.find(name => name.language === 'en')?.name ||
                     tag.key;
      
      if (!tagCounts[tagName]) {
        tagCounts[tagName] = 0;
        tagTierSum[tagName] = 0;
      }
      
      tagCounts[tagName]++;
      tagTierSum[tagName] += problem.level;
    });
  });
  
  // 태그별 평균 티어 계산
  Object.keys(tagCounts).forEach(tag => {
    tagTiers[tag] = Math.round(tagTierSum[tag] / tagCounts[tag]);
  });
  
  // 전체 태그 평균 티어 계산
  let allTagTierSum = 0;
  let allTagCount = 0;
  
  Object.values(tagTierSum).forEach(tierSum => {
    allTagTierSum += tierSum;
  });
  
  Object.values(tagCounts).forEach(count => {
    allTagCount += count;
  });
  
  const allTagTier = Math.round(allTagTierSum / allTagCount);
  
  return { tagTiers, allTagTier };
}

/**
 * 최종 추천 티어 계산
 * @param {Object} userInfo - 사용자 정보
 * @param {number} allTagTier - 전체 태그 평균 티어
 * @returns {number} - 추천 티어
 */
function calculateAverageTier(userInfo, allTagTier) {
  // 사용자 티어와 태그 평균 티어의 가중 평균
  // 사용자 티어(70%), 태그 티어(30%)
  const userTierWeight = 0.7;
  const tagTierWeight = 0.3;
  
  const averageTier = Math.round(userInfo.tier * userTierWeight + allTagTier * tagTierWeight);
  
  return averageTier;
}

/**
 * 태그 기반 문제 추천
 * @param {number} targetTier - 목표 티어
 * @param {Array} solvedProblems - 해결한 문제 배열
 * @param {Array} solvedProblemsWithDetails - 문제 상세 정보 배열
 * @param {number} page - 페이지 번호
 * @returns {Promise<Array>} - 추천 문제 배열
 */
async function recommendTagBasedProblems(targetTier, solvedProblems, solvedProblemsWithDetails, page) {
  try {
    // 사용자가 가장 많이 푼 태그 찾기
    const tagCounts = {};
    
    solvedProblemsWithDetails.forEach(problem => {
      if (!problem.tags || problem.tags.length === 0) {
        return;
      }
      
      problem.tags.forEach(tag => {
        const tagName = tag.displayNames.find(name => name.language === 'ko')?.name || 
                       tag.displayNames.find(name => name.language === 'en')?.name ||
                       tag.key;
        
        if (!tagCounts[tagName]) {
          tagCounts[tagName] = 0;
        }
        
        tagCounts[tagName]++;
      });
    });
    
    // 가장 많이 푼 태그 상위 5개 선택
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
    
    if (topTags.length === 0) {
      return [];
    }
    
    // 각 페이지마다 다른 태그 선택 (태그 순환 방식 유지)
    const selectedTagIndex = (page - 1) % topTags.length;
    const selectedTag = topTags[selectedTagIndex];
    
    console.log(`태그 기반 추천에 사용된 태그: ${selectedTag} (${tagCounts[selectedTag]}회 해결)`);
    
    // 목표 티어 범위 설정 (±2)
    const minTier = Math.max(1, targetTier - 2);
    const maxTier = Math.min(30, targetTier + 2);
    
    // 태그 ID 찾기 위한 검색
    const tagSearchResponse = await fetch(`https://solved.ac/api/v3/search/tag?query=${encodeURIComponent(selectedTag)}`);
    if (!tagSearchResponse.ok) {
      return [];
    }
    
    const tagSearchData = await tagSearchResponse.json();
    if (tagSearchData.count === 0) {
      return [];
    }
    
    const tagId = tagSearchData.items[0].key;
    
    // 해당 태그의 문제 검색 (API에 page 파라미터 직접 전달)
    const tierRange = `*${minTier}..${maxTier}`;
    const taggedProblemResponse = await fetch(`https://solved.ac/api/v3/search/problem?query=tag:${tagId}+${tierRange}&page=${page}&sort=level&direction=asc`); // 레벨 오름차순 정렬 추가
    
    if (!taggedProblemResponse.ok) {
      return [];
    }
    
    const taggedProblemData = await taggedProblemResponse.json();
    
    // 이미 해결한 문제 제외
    const solvedProblemSet = new Set(solvedProblems);
    
    // API 결과에서 해결하지 않은 문제 최대 2개 선택 (오프셋 로직 제거)
    const recommendedProblems = taggedProblemData.items
      .filter(problem => !solvedProblemSet.has(problem.problemId))
      .slice(0, 2)  // API 페이지 결과에서 최대 2개 선택
      .map(problem => ({
        id: problem.problemId.toString(),
        title: problem.titleKo,
        level: problem.level.toString(),
        tags: problem.tags.map(tag => tag.displayNames.find(name => name.language === 'ko')?.name || 
                                      tag.displayNames.find(name => name.language === 'en')?.name ||
                                      tag.key),
        acceptedUserCount: problem.acceptedUserCount,
        averageTries: problem.averageTries
      }));
    
    return recommendedProblems;
  } catch (error) {
    console.error("태그 기반 문제 추천 실패:", error);
    return [];
  }
}

/**
 * 인기도 기반 문제 추천
 * @param {number} targetTier - 목표 티어
 * @param {Array} solvedProblems - 해결한 문제 배열
 * @param {Array} solvedProblemsWithDetails - 문제 상세 정보 배열
 * @param {number} page - 페이지 번호
 * @param {number} count - 추천 문제 수
 * @returns {Promise<Array>} - 추천 문제 배열
 */
async function recommendPopularityBasedProblems(targetTier, solvedProblems, solvedProblemsWithDetails, page, count) {
  try {
    if (count <= 0) {
      return [];
    }
    
    // 목표 티어 범위 설정 (±3)
    const minTier = Math.max(1, targetTier - 3);
    const maxTier = Math.min(30, targetTier + 3);
    
    // 인기도 기반 문제 검색 (API에 page 파라미터 직접 전달)
    const tierRange = `*${minTier}..${maxTier}`;
    // 인기도(solved) 내림차순 정렬
    const popularProblemResponse = await fetch(`https://solved.ac/api/v3/search/problem?query=${tierRange}+solvable:true&sort=solved&direction=desc&page=${page}`);
    
    if (!popularProblemResponse.ok) {
      return [];
    }
    
    const popularProblemData = await popularProblemResponse.json();
    
    // 이미 해결한 문제 제외
    const solvedProblemSet = new Set(solvedProblems);
    
    // API 결과에서 해결하지 않은 문제 count개 선택 (오프셋 로직 제거)
    const recommendedProblems = popularProblemData.items
      .filter(problem => !solvedProblemSet.has(problem.problemId))
      .slice(0, count) // API 페이지 결과에서 필요한 개수(count)만큼 선택
      .map(problem => ({
        id: problem.problemId.toString(),
        title: problem.titleKo,
        level: problem.level.toString(),
        tags: problem.tags.map(tag => tag.displayNames.find(name => name.language === 'ko')?.name || 
                                    tag.displayNames.find(name => name.language === 'en')?.name ||
                                    tag.key),
        acceptedUserCount: problem.acceptedUserCount,
        averageTries: problem.averageTries
      }));
    
    return recommendedProblems;
  } catch (error) {
    console.error("인기도 기반 문제 추천 실패:", error);
    return [];
  }
}

/**
 * 추가 인기도 기반 문제 추천 (부족한 개수 채우기 위한 함수)
 * @param {number} targetTier - 목표 티어
 * @param {Set} excludedProblemIds - 제외할 문제 ID 목록 (이미 해결했거나 이미 추천된 문제)
 * @param {number} page - 페이지 번호
 * @param {number} count - 필요한 문제 수
 * @returns {Promise<Array>} - 추천 문제 배열
 */
async function recommendAdditionalPopularityProblems(targetTier, excludedProblemIds, page, count) {
  try {
    if (count <= 0) {
      return [];
    }
    
    // 목표 티어 범위 설정 (±6, 더 넓은 범위로 검색)
    const minTier = Math.max(1, targetTier - 6);
    const maxTier = Math.min(30, targetTier + 6);
    
    // 인기도 기반 문제 검색
    const tierRange = `*${minTier}..${maxTier}`;
    const apiUrl = `https://solved.ac/api/v3/search/problem?query=${tierRange}+solvable:true&sort=solved&direction=desc&page=${page}`;
    
    console.log(`추가 문제 API 호출: ${apiUrl}`);
    
    const popularProblemResponse = await fetch(apiUrl);
    
    if (!popularProblemResponse.ok) {
      console.error(`API 응답 오류: ${popularProblemResponse.status} ${popularProblemResponse.statusText}`);
      // 일반 검색 실패 시 랜덤 문제 검색으로 폴백
      return await recommendRandomProblems(targetTier, excludedProblemIds, count);
    }
    
    const popularProblemData = await popularProblemResponse.json();
    console.log(`API 응답: 총 ${popularProblemData.count}개 문제 중 ${popularProblemData.items.length}개 수신`);
    
    // API가 비어있는 응답을 반환한 경우
    if (!popularProblemData.items || popularProblemData.items.length === 0) {
      console.log('API가 문제 목록을 반환하지 않았습니다. 랜덤 문제 추천으로 전환합니다.');
      return await recommendRandomProblems(targetTier, excludedProblemIds, count);
    }
    
    // 응답에서 가져온 문제 ID 목록 로깅
    const problemIds = popularProblemData.items.map(p => p.problemId);
    console.log(`응답으로 받은 문제 ID 목록: ${problemIds.join(', ')}`);
    
    // 제외된 문제 ID 확인
    const excludedIds = problemIds.filter(id => excludedProblemIds.has(id));
    if (excludedIds.length > 0) {
      console.log(`제외된 문제 ID: ${excludedIds.join(', ')}`);
    }
    
    // 이미 해결했거나 이미 추천된 문제 제외
    const recommendedProblems = popularProblemData.items
      .filter(problem => {
        const isExcluded = excludedProblemIds.has(problem.problemId);
        if (isExcluded) {
          console.log(`문제 ${problem.problemId} 제외됨: 이미 해결했거나 추천됨`);
        }
        return !isExcluded;
      })
      .slice(0, count)
      .map(problem => ({
        id: problem.problemId.toString(),
        title: problem.titleKo,
        level: problem.level.toString(),
        tags: problem.tags.map(tag => tag.displayNames.find(name => name.language === 'ko')?.name || 
                                    tag.displayNames.find(name => name.language === 'en')?.name ||
                                    tag.key),
        acceptedUserCount: problem.acceptedUserCount,
        averageTries: problem.averageTries
      }));
    
    console.log(`추가 문제 추천 결과: ${recommendedProblems.length}개 문제 추천`);
    
    // 추천된 문제가 없는 경우 랜덤 문제 추천 시도
    if (recommendedProblems.length === 0) {
      console.log('인기도 기반 추천에서 문제를 찾지 못했습니다. 랜덤 문제 추천으로 전환합니다.');
      return await recommendRandomProblems(targetTier, excludedProblemIds, count);
    }
    
    return recommendedProblems;
  } catch (error) {
    console.error("추가 인기도 기반 문제 추천 실패:", error);
    // 오류 발생 시 랜덤 문제 추천으로 폴백
    return await recommendRandomProblems(targetTier, excludedProblemIds, count);
  }
}

/**
 * 랜덤 문제 추천 (마지막 대안)
 * @param {number} targetTier - 목표 티어
 * @param {Set} excludedProblemIds - 제외할 문제 ID 목록
 * @param {number} count - 필요한 문제 수
 * @returns {Promise<Array>} - 추천 문제 배열
 */
async function recommendRandomProblems(targetTier, excludedProblemIds, count) {
  try {
    console.log(`랜덤 문제 추천 시작: 목표 티어 ${targetTier}, 필요 개수 ${count}`);
    
    // 티어 범위 크게 설정 (±8)
    const minTier = Math.max(1, targetTier - 8);
    const maxTier = Math.min(30, targetTier + 8);
    const tierRange = `*${minTier}..${maxTier}`;
    
    // 랜덤 정렬로 문제 가져오기
    const apiUrl = `https://solved.ac/api/v3/search/problem?query=${tierRange}+solvable:true&sort=random&page=1`;
    console.log(`랜덤 문제 API 호출: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`랜덤 문제 API 응답 오류: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`랜덤 API 응답: ${data.items?.length || 0}개 문제 수신`);
    
    if (!data.items || data.items.length === 0) {
      console.log('랜덤 API가 문제를 반환하지 않았습니다.');
      return [];
    }
    
    // 이미 제외된 문제 필터링
    const recommendedProblems = data.items
      .filter(problem => !excludedProblemIds.has(problem.problemId))
      .slice(0, count)
      .map(problem => ({
        id: problem.problemId.toString(),
        title: problem.titleKo,
        level: problem.level.toString(),
        tags: problem.tags.map(tag => tag.displayNames.find(name => name.language === 'ko')?.name || 
                                   tag.displayNames.find(name => name.language === 'en')?.name ||
                                   tag.key),
        acceptedUserCount: problem.acceptedUserCount,
        averageTries: problem.averageTries
      }));
    
    console.log(`랜덤 문제 추천 결과: ${recommendedProblems.length}개 추천`);
    return recommendedProblems;
  } catch (error) {
    console.error("랜덤 문제 추천 실패:", error);
    return [];
  }
}

/**
 * 티어 이름 가져오기 (한국어)
 * @param {number} tier - 티어 번호
 * @returns {string} - 티어 이름
 */
function getTierNameKo(tier) {
  const tierNames = [
    '언랭크',
    '브론즈 5', '브론즈 4', '브론즈 3', '브론즈 2', '브론즈 1',
    '실버 5', '실버 4', '실버 3', '실버 2', '실버 1',
    '골드 5', '골드 4', '골드 3', '골드 2', '골드 1',
    '플래티넘 5', '플래티넘 4', '플래티넘 3', '플래티넘 2', '플래티넘 1',
    '다이아몬드 5', '다이아몬드 4', '다이아몬드 3', '다이아몬드 2', '다이아몬드 1',
    '루비 5', '루비 4', '루비 3', '루비 2', '루비 1'
  ];
  
  if (tier < 0 || tier >= tierNames.length) {
    return '알 수 없음';
  }
  
  return tierNames[tier];
}

/**
 * 추천 결과 포맷팅
 * @param {Array} recommendedProblems - 추천 문제 배열
 * @param {number} targetTier - 목표 티어
 * @returns {string} - 포맷팅된 추천 결과 (HTML)
 */
function formatRecommendations(recommendedProblems, targetTier) {
  if (recommendedProblems.length === 0) {
    return "<div class='text-red-500 font-bold text-xl'>추천할 문제가 없습니다. 다른 페이지나 다른 백준 ID를 시도해보세요.</div>";
  }
  
  // 티어 색상 매핑
  const tierColors = {
    'Bronze': 'bg-amber-800',
    'Silver': 'bg-gray-400',
    'Gold': 'bg-yellow-400',
    'Platinum': 'bg-teal-400',
    'Diamond': 'bg-blue-400',
    'Ruby': 'bg-red-500'
  };
  
  // HTML 생성
  let html = `<div class='space-y-4'>`;
  
  recommendedProblems.forEach((problem, index) => {
    const problemTier = getTierNameKo(parseInt(problem.level));
    const tierPrefix = problemTier.split(' ')[0]; // '브론즈', '실버' 등
    
    let tierColor = 'bg-gray-300';
    if (tierPrefix === '브론즈') tierColor = tierColors['Bronze'];
    else if (tierPrefix === '실버') tierColor = tierColors['Silver'];
    else if (tierPrefix === '골드') tierColor = tierColors['Gold'];
    else if (tierPrefix === '플래티넘') tierColor = tierColors['Platinum'];
    else if (tierPrefix === '다이아몬드') tierColor = tierColors['Diamond'];
    else if (tierPrefix === '루비') tierColor = tierColors['Ruby'];
    
    html += `
    <div class='border-2 border-gray-300 rounded-lg p-4 bg-white shadow-md hover:shadow-lg transition duration-200'>
      <div class='flex items-center justify-between'>
        <div class='flex items-center space-x-3'>
          <div class='${tierColor} text-white font-bold py-1 px-2 rounded-md'>${problemTier}</div>
          <a href='https://www.acmicpc.net/problem/${problem.id}' target='_blank' class='text-blue-600 text-lg font-bold hover:underline'>${problem.id}. ${problem.title}</a>
        </div>
        <div class='text-sm'>
          <span class='text-green-600 font-medium'>맞은 사람: ${problem.acceptedUserCount}</span>
          <span class='ml-2 text-orange-500 font-medium'>평균 시도: ${problem.averageTries.toFixed(2)}</span>
        </div>
      </div>
      <div class='mt-2'>
        <span class='text-xs font-medium bg-gray-200 rounded-full px-2 py-1'>태그:</span>
        <div class='mt-1 flex flex-wrap gap-1'>
          ${problem.tags.map(tag => `
            <span class='text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-1'>${tag}</span>
          `).join('')}
        </div>
      </div>
    </div>
    `;
  });
  
  html += `</div>`;
  return html;
}

module.exports = { recommendBaekjoonProblems }; 