import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import Layout from '../components/Layout';
import Image from 'next/image';

export default function CalendarPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDateLogs, setSelectedDateLogs] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showSidePanel, setShowSidePanel] = useState(false);

  // 데이터 불러오기
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/logs');
        const data = await response.json();
        
        // 날짜를 기준으로 내림차순 정렬 (최신순)
        data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 각 로그 항목에 날짜 포맷팅 추가
        const processedData = data.map(log => ({
          ...log,
          date: format(parseISO(log.timestamp), 'yyyy-MM-dd'),
          formattedTime: format(parseISO(log.timestamp), 'HH:mm:ss', { locale: ko }),
          formattedDate: format(parseISO(log.timestamp), 'yyyy년 MM월 dd일', { locale: ko })
        }));
        
        setLogs(processedData);
      } catch (error) {
        console.error('로그 데이터를 불러오는 중 오류 발생:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  // 날짜별 로그 카운트
  const getEventsByDate = () => {
    const eventsByDate = {};
    
    // 날짜별로 로그 항목 수 집계
    logs.forEach(log => {
      const date = log.date;
      if (!eventsByDate[date]) {
        eventsByDate[date] = 0;
      }
      eventsByDate[date] += 1;
    });
    
    // FullCalendar 이벤트 형식으로 변환
    return Object.keys(eventsByDate).map(date => ({
      title: `${eventsByDate[date]}건`,
      date,
      count: eventsByDate[date],
      backgroundColor: getBackgroundColor(eventsByDate[date]),
      borderColor: getBackgroundColor(eventsByDate[date]),
      textColor: '#fff',
      display: 'block',
    }));
  };

  // 인증 건수에 따른 그라데이션 색상 지정
  const getBackgroundColor = (count) => {
    if (count >= 10) return 'rgba(59, 130, 246, 0.95)'; // 많음
    if (count >= 5) return 'rgba(59, 130, 246, 0.7)';  // 중간
    return 'rgba(59, 130, 246, 0.4)';                 // 적음
  };

  // 날짜 클릭 이벤트 핸들러
  const handleDateClick = (info) => {
    const date = info.dateStr;
    const filteredLogs = logs.filter(log => log.date === date);
    
    // 이미 선택된 날짜를 다시 클릭하면 사이드 패널 닫기
    if (selectedDate === date && showSidePanel) {
      setShowSidePanel(false);
    } else {
      setSelectedDate(date);
      setSelectedDateLogs(filteredLogs);
      setShowSidePanel(true);
    }
  };

  // 이벤트 클릭 핸들러 (건수 클릭)
  const handleEventClick = (info) => {
    const date = info.event.startStr;
    const filteredLogs = logs.filter(log => log.date === date);
    
    // 이미 선택된 날짜를 다시 클릭하면 사이드 패널 닫기
    if (selectedDate === date && showSidePanel) {
      setShowSidePanel(false);
    } else {
      setSelectedDate(date);
      setSelectedDateLogs(filteredLogs);
      setShowSidePanel(true);
    }
  };

  // 이미지 미리보기 모달 표시
  const openImagePreview = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  // 이미지 미리보기 모달 닫기
  const closeImagePreview = () => {
    setSelectedImage(null);
  };

  return (
    <Layout>
      <Head>
        <title>인증 캘린더 - 코딩 스터디</title>
      </Head>
      
      <h1 className="text-2xl font-bold mb-6">📅 인증 캘린더</h1>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 왼쪽 캘린더 영역 */}
        <div className={`${showSidePanel ? 'lg:w-2/3' : 'w-full'} bg-dark-800 rounded-lg shadow-lg p-5`}>
          {loading ? (
            <div className="flex flex-col justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
              <p className="text-gray-400">데이터를 불러오는 중입니다...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-96">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-400">인증 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="calendar-container">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="ko"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: ''
                }}
                events={getEventsByDate()}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                height="auto"
                dayMaxEvents={1}
              />
            </div>
          )}
        </div>
        
        {/* 오른쪽 사이드 패널 */}
        {showSidePanel && (
          <div className="lg:w-1/3 bg-dark-800 rounded-lg shadow-lg p-5 max-h-[800px] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {selectedDate && format(new Date(selectedDate), 'yyyy년 MM월 dd일', { locale: ko })}
              </h2>
              <button 
                onClick={() => setShowSidePanel(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            {selectedDateLogs.length > 0 ? (
              <div className="space-y-4">
                {selectedDateLogs.map((log, index) => (
                  <div key={index} className="bg-dark-700 rounded-lg p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{log.nickname}</div>
                      <div className="text-xs text-gray-400">{log.formattedTime}</div>
                    </div>
                    
                    <div 
                      className="w-full h-48 relative rounded-lg overflow-hidden cursor-pointer mb-2"
                      onClick={() => openImagePreview(log.image_url)}
                    >
                      <div className="absolute inset-0">
                        <img 
                          src={log.image_url} 
                          alt={`${log.nickname}의 인증 이미지`}
                          className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <div className="text-gray-400">제출 시간:</div>
                      <div>{log.formattedTime}</div>
                    </div>
                    
                    {log.problemCount && (
                      <div className="flex justify-between text-sm mt-1">
                        <div className="text-gray-400">제출 문제:</div>
                        <div>{log.problemCount}문제</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>선택하신 날짜에 인증 내역이 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 이미지 미리보기 모달 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={closeImagePreview}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <button 
              className="absolute top-2 right-2 bg-dark-800 rounded-full p-1 text-white hover:bg-dark-700"
              onClick={closeImagePreview}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={selectedImage} 
              alt="인증 이미지 확대" 
              className="max-h-[90vh] max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

// 캘린더 이벤트 렌더링 커스터마이징
function renderEventContent(eventInfo) {
  return (
    <div className="text-center px-1 py-0.5 w-full rounded-sm text-xs font-medium cursor-pointer">
      {eventInfo.event.title}
    </div>
  );
} 