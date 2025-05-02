import React, { useState } from 'react';
import Head from 'next/head';
import LoggedImageUploader from '../components/LoggedImageUploader';

/**
 * 이미지 업로드 페이지
 * 사용자가 이미지를 업로드하고 로깅할 수 있는 페이지
 */
export default function UploadPage() {
  const [nickname, setNickname] = useState('');
  const [isNicknameSet, setIsNicknameSet] = useState(false);

  // 닉네임 설정 핸들러
  const handleSetNickname = (e) => {
    e.preventDefault();
    if (nickname.trim()) {
      setIsNicknameSet(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <Head>
        <title>이미지 업로드 - Discord Bot</title>
        <meta name="description" content="Discord Bot을 위한 이미지 업로드 페이지" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">이미지 업로드</h1>
        
        <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6">
          {!isNicknameSet ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">닉네임 설정</h2>
              <p className="text-gray-600 mb-4">
                이미지 업로드를 위해 닉네임을 입력해주세요. 이 닉네임은 로그에 기록됩니다.
              </p>
              <form onSubmit={handleSetNickname} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  className="flex-grow p-2 border border-gray-300 rounded"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  시작하기
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-4 bg-blue-50 rounded-md">
                <p className="text-blue-800">
                  <span className="font-semibold">{nickname}</span>님으로 업로드합니다.
                  <button
                    onClick={() => setIsNicknameSet(false)}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    변경
                  </button>
                </p>
              </div>
              
              <LoggedImageUploader
                nickname={nickname}
                serverId="website"
                serverName="이미지 업로드 페이지"
              />
              
              <div className="mt-8 text-sm text-gray-600 border-t pt-4">
                <h3 className="font-medium text-gray-800 mb-2">참고사항:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>업로드한 이미지는 Discord 서버에 로깅됩니다.</li>
                  <li>이미지는 10MB 이하여야 합니다.</li>
                  <li>업로드한 이미지는 공개 로그에 표시될 수 있습니다.</li>
                  <li>부적절한 이미지를 업로드하지 마세요.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 