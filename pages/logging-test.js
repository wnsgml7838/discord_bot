import { useState } from 'react';
import Head from 'next/head';
import LoggedButton from '../components/LoggedButton';
import LoggedLink from '../components/LoggedLink';
import { logUserActivity, logFormSubmit, logError } from '../utils/activityLogger';

export default function LoggingTest() {
  const [result, setResult] = useState(null);
  const [userId, setUserId] = useState('test-user-123');
  const [formData, setFormData] = useState('');

  // 직접 로깅 API 호출 테스트
  const testDirectLogging = async () => {
    try {
      const response = await logUserActivity('manual_test', userId, { 
        source: 'test_page',
        test_mode: false // 실제 Discord로 전송
      });
      setResult({
        success: true,
        message: '직접 로깅 API 호출 성공',
        data: response
      });
    } catch (error) {
      setResult({
        success: false,
        message: '직접 로깅 API 호출 실패',
        error: error.message
      });
    }
  };

  // 폼 제출 테스트
  const handleFormSubmit = (e) => {
    e.preventDefault();
    logFormSubmit('test-form', userId, { 
      input: formData,
      test_mode: false // 실제 Discord로 전송
    });
    setResult({
      success: true,
      message: '폼 제출 로깅 완료',
      data: { form: 'test-form', input: formData }
    });
  };

  // 에러 로깅 테스트
  const testErrorLogging = () => {
    try {
      // 일부러 에러 발생
      throw new Error('테스트 에러 메시지');
    } catch (error) {
      // 실제 Discord로 에러 로깅
      logError({ 
        ...error, 
        message: error.message,
        test_mode: false
      }, userId);
      
      setResult({
        success: true,
        message: '에러 로깅 완료',
        error: error.message
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>로깅 테스트 페이지</title>
      </Head>

      <main className="space-y-8">
        <h1 className="text-2xl font-bold mb-4">Discord Webhook 로깅 테스트</h1>
        
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">사용자 ID 설정</h2>
          <div className="flex items-center mb-4">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="border p-2 mr-2 flex-1"
              placeholder="사용자 ID 입력"
            />
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">버튼 클릭 로깅 테스트</h2>
          <div className="space-y-2">
            <LoggedButton
              id="test-button-1"
              userId={userId}
              metadata={{ buttonType: 'primary', test_mode: false }}
              className="bg-blue-500 text-white p-2 rounded mr-2"
            >
              테스트 버튼 1
            </LoggedButton>
            
            <LoggedButton
              id="test-button-2"
              userId={userId}
              metadata={{ buttonType: 'secondary', test_mode: false }}
              className="bg-green-500 text-white p-2 rounded mr-2"
            >
              테스트 버튼 2
            </LoggedButton>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">링크 클릭 로깅 테스트</h2>
          <div className="space-y-2">
            <LoggedLink
              id="test-link-1"
              userId={userId}
              href="/"
              metadata={{ linkType: 'internal', test_mode: false }}
              className="text-blue-500 underline mr-4"
            >
              홈으로 이동
            </LoggedLink>
            
            <LoggedLink
              id="test-link-2"
              userId={userId}
              href="https://discord.com"
              metadata={{ linkType: 'external', test_mode: false }}
              className="text-blue-500 underline"
            >
              Discord 웹사이트로 이동
            </LoggedLink>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">폼 제출 로깅 테스트</h2>
          <form onSubmit={handleFormSubmit}>
            <input
              type="text"
              value={formData}
              onChange={(e) => setFormData(e.target.value)}
              className="border p-2 mr-2"
              placeholder="아무 텍스트나 입력"
            />
            <button type="submit" className="bg-purple-500 text-white p-2 rounded">
              폼 제출
            </button>
          </form>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">직접 API 호출 테스트</h2>
          <button 
            onClick={testDirectLogging} 
            className="bg-red-500 text-white p-2 rounded mr-2"
          >
            직접 로깅 API 호출
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">에러 로깅 테스트</h2>
          <button 
            onClick={testErrorLogging} 
            className="bg-yellow-500 text-white p-2 rounded"
          >
            에러 발생 및 로깅
          </button>
        </div>

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
            <h2 className="text-xl font-semibold mb-2">테스트 결과</h2>
            <p><strong>상태:</strong> {result.success ? '성공' : '실패'}</p>
            <p><strong>메시지:</strong> {result.message}</p>
            {result.error && <p><strong>오류:</strong> {result.error}</p>}
            {result.data && (
              <div>
                <p><strong>응답 데이터:</strong></p>
                <pre className="bg-gray-800 text-white p-2 rounded mt-2 overflow-x-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
} 