import React, { useState, useRef } from 'react';
import { logImageAll } from '../utils/imageLogger';

/**
 * 이미지 업로드 및 로깅 컴포넌트
 * 이미지를 업로드하고 서버리스 API를 통해 로깅합니다.
 */
const LoggedImageUploader = ({ nickname = '익명', serverId, serverName = '웹사이트' }) => {
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // 이미지 업로드 핸들러
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 유형 검증
    if (!file.type.startsWith('image/')) {
      setErrorMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 검증 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('이미지 크기는 10MB 이하여야 합니다.');
      return;
    }

    // 미리보기 URL 생성
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setUploadStatus('uploading');
    setProgress(30);
    setErrorMessage('');

    try {
      // 이미지를 임시 호스팅 서비스에 업로드하는 로직
      // (실제 구현 시 이 부분을 적절한 이미지 호스팅 서비스로 변경)
      // 여기서는 이미지를 실제로 업로드하지 않고 예시를 제공합니다
      
      // 업로드 시뮬레이션 (실제 구현 시 이 부분을 대체)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(60);
      
      // 이미지 URL 생성 (임시 URL, 실제 구현 시 서버에서 받은 URL로 대체)
      const image_url = preview; // 실제 구현시 서버에서 받은 URL로 교체
      
      // 이미지 로깅
      const result = await logImageAll({
        nickname,
        image_url,
        serverId: serverId || 'website',
        serverName: serverName || '웹사이트'
      });
      
      setProgress(100);
      
      if (result.success) {
        setUploadStatus('success');
      } else {
        setUploadStatus('error');
        setErrorMessage('이미지 로깅 중 오류가 발생했습니다: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || '이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  // 업로드 재시도
  const handleRetry = () => {
    setUploadStatus('idle');
    setPreviewUrl('');
    setErrorMessage('');
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">이미지 업로드</h2>
      
      {/* 상태 표시 */}
      {uploadStatus === 'success' && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
          <p className="font-medium">이미지 업로드 및 로깅 성공!</p>
        </div>
      )}
      
      {uploadStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          <p className="font-medium">오류 발생: {errorMessage}</p>
        </div>
      )}
      
      {/* 업로드 폼 */}
      {uploadStatus !== 'success' && (
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">이미지 선택</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full border border-gray-300 rounded-md p-2"
            disabled={uploadStatus === 'uploading'}
            ref={fileInputRef}
          />
        </div>
      )}
      
      {/* 미리보기 */}
      {previewUrl && (
        <div className="mb-4">
          <p className="text-gray-700 mb-2">미리보기:</p>
          <img
            src={previewUrl}
            alt="미리보기"
            className="max-w-full max-h-64 rounded-md"
          />
        </div>
      )}
      
      {/* 진행 상태 표시 */}
      {uploadStatus === 'uploading' && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">업로드 중... {progress}%</p>
        </div>
      )}
      
      {/* 작업 버튼 */}
      {uploadStatus === 'success' || uploadStatus === 'error' ? (
        <button
          onClick={handleRetry}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          다시 업로드
        </button>
      ) : null}
    </div>
  );
};

export default LoggedImageUploader; 