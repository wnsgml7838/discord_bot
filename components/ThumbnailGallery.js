import React from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const ThumbnailGallery = ({ submissions, onImageClick }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">최신 인증 내역</h2>
      {submissions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {submissions.map((submission, index) => (
            <div 
              key={index} 
              className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative pb-[60%] bg-gray-100">
                <img
                  src={submission.image_url}
                  alt={`${submission.nickname}의 인증`}
                  className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                  onClick={() => onImageClick(submission.image_url)}
                />
              </div>
              <div className="p-2">
                <p className="font-medium text-sm">{submission.nickname}</p>
                <p className="text-xs text-gray-500">
                  {format(parseISO(submission.timestamp), 'MM월 dd일 HH:mm', { locale: ko })}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 text-gray-500">
          <p>아직 인증 기록이 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default ThumbnailGallery; 