import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { logUserActivity, logButtonClick, logFormSubmit } from '../utils/activityLogger';
import LoggedLink from '../components/LoggedLink';

export default function RecommendPage() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 문제 추천 요청 함수
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!handle) {
      setError('백준 아이디를 입력해주세요.');
      return;
    }
    
    // 폼 제출 로깅
    logFormSubmit('baekjoon-recommend-form', null, {
      handle: handle,
      page: 1
    });
    
    fetchRecommendations(1); // 첫 페이지부터 시작
  };

  // 페이지 이동 함수
  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    if (loading) return;
    
    // 페이지 이동 로깅
    logButtonClick(`baekjoon-page-${newPage}`, null, {
      handle: handle,
      from_page: currentPage,
      to_page: newPage
    });
    
    fetchRecommendations(newPage);
  };

  // 추천 데이터 가져오기
  const fetchRecommendations = async (page) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ handle, page }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '문제 추천에 실패했습니다.');
      }
      
      setResult(data.result);
      setCurrentPage(page);
      
      // 추천 결과 로깅
      logUserActivity('baekjoon_recommend_result', null, {
        handle: handle, 
        page: page,
        success: true
      });
    } catch (error) {
      console.error('API 요청 오류:', error);
      setError(error.message || '문제 추천 중 오류가 발생했습니다.');
      
      // 오류 로깅
      logUserActivity('baekjoon_recommend_error', null, {
        handle: handle,
        page: page,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 문제 풀기 버튼 클릭 로깅
  const handleSolveProblem = (problemId, problemTitle) => {
    logButtonClick(`solve-problem-${problemId}`, null, {
      problem_id: problemId,
      problem_title: problemTitle,
      handle: handle
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Head>
        <title>백준 문제 추천 | YEARDREAM 5th ALGORITHM</title>
        <meta name="description" content="solved.ac API 기반 맞춤형 백준 문제 추천 시스템" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-center mb-2">백준 문제 추천</h1>
        <p className="text-center text-gray-600">
          solved.ac API 기반 맞춤형 백준 문제 추천 시스템
        </p>
      </header>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">문제 추천</h1>
        <LoggedLink
          id="dashboard-link"
          href="/"
          metadata={{ from_page: 'recommend' }}
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>대시보드</span>
        </LoggedLink>
      </div>

      <main>
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="handle" className="block text-sm font-medium text-gray-700 mb-1">
                백준 아이디
              </label>
              <input
                type="text"
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="예: joonhee7838"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">
                사용자의 해결한 문제를 분석하여 적절한 난이도의 문제를 추천합니다.
                추천 시스템은 다음과 같은 과정으로 작동합니다:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 pl-2">
                <li>사용자가 해결한 문제의 태그별 티어를 계산</li>
                <li>사용자의 평균 티어와 태그 티어를 고려한 최적 난이도 산출</li>
                <li>사용자에게 적절한 난이도의 문제 추천</li>
                <li>페이지 기능을 통해 더 많은 추천 문제 확인 가능</li>
              </ol>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              onClick={() => {
                if (!loading && handle) {
                  logButtonClick('recommend-button', null, { handle });
                }
              }}
            >
              {loading ? '문제 추천 중...' : '문제 추천받기'}
            </button>
          </form>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {result && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">추천 결과</h2>
              {/* 페이지 네비게이션 */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className={`p-2 rounded-md ${
                    currentPage <= 1 || loading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="text-sm text-gray-700">페이지 {currentPage}</span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={loading}
                  className={`p-2 rounded-md ${
                    loading
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="rounded-md">
              {/* "문제 풀기" 버튼을 위한 이벤트 리스너 추가 */}
              <div 
                className="text-black" 
                dangerouslySetInnerHTML={{ __html: result }}
                onClick={(e) => {
                  // "문제 풀기" 버튼 클릭 감지 및 로깅
                  if (e.target.tagName === 'A' && e.target.innerText.includes('문제 풀기')) {
                    const problemUrl = e.target.href;
                    const problemId = problemUrl.split('/').pop();
                    const problemTitle = e.target.closest('div').querySelector('h3')?.innerText || 'Unknown Problem';
                    handleSolveProblem(problemId, problemTitle);
                  }
                }}
              />
            </div>
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">백준 문제 추천 시스템 안내</h2>
          <p className="text-sm text-gray-700 mb-4">
            이 추천 시스템은 사용자의 백준 프로필을 분석하여 사용자가 너무 쉽게 느끼지도, 
            너무 어렵게 느끼지도 않는 최적의 난이도 문제를 추천해 드립니다.
          </p>
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="font-medium text-blue-600">태그 티어 계산</h3>
              <p className="text-sm text-gray-600">
                사용자가 해결한 문제의 태그별 티어를 계산합니다. 각 태그에 대해 사용자가 풀었던 
                가장 어려운 문제들을 기준으로 해당 태그의 숙련도를 평가합니다.
              </p>
            </div>
            <div className="border-b pb-2">
              <h3 className="font-medium text-blue-600">평균 티어 산출</h3>
              <p className="text-sm text-gray-600">
                사용자의 전체 티어와 태그 티어의 평균값을 사용하여 최적의 추천 난이도를 결정합니다.
                이를 통해 사용자의 실력에 맞는 적절한 도전 과제를 제공합니다.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-blue-600">페이지 기능</h3>
              <p className="text-sm text-gray-600">
                한 번에 5개의 문제를 추천하며, 페이지 버튼을 통해 더 많은 추천 문제를 확인할 수 있습니다.
                각 페이지마다 사용자의 평균 티어에 맞는 새로운 문제들이 추천됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="mt-8 pt-8 border-t border-gray-300 text-center text-gray-600">
        <p>코딩테스트 인증 스터디 대시보드 © {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
} 