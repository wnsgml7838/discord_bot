import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

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
      })
      .catch(error => {
        console.error('Error fetching logs:', error);
        setError(error.message || '로그 데이터를 불러오는데 실패했습니다.');
        setLoading(false);
      });
  }, []);

  // 이미지 미리보기 모달 표시
  const openImagePreview = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // 이미지 미리보기 모달 닫기
  const closeImagePreview = () => {
    setSelectedImage(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>코딩테스트 인증 대시보드</title>
        <meta name="description" content="코딩테스트 인증 스터디 대시보드" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className="text-3xl font-bold mb-6 text-center">코딩테스트 인증 대시보드</h1>
        
        {loading ? (
          <div className="text-center py-10">로딩 중...</div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            {error}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <p className="font-semibold">총 인증 횟수: {logs.length}회</p>
            </div>
            
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      닉네임
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      인증 일시
                    </th>
                    <th className="px-6 py-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      인증 이미지
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.nickname}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{log.timestampStr || log.timestamp}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => openImagePreview(log.image_url)} 
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                          이미지 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {logs.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                아직 저장된 인증 기록이 없습니다.
              </div>
            )}
          </div>
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