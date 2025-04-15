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
  
  // 로그 항목 관리 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLogData, setNewLogData] = useState({
    nickname: '',
    image_url: '',
    problemCount: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

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
      // 편집 폼 초기화
      resetForms();
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
      // 편집 폼 초기화
      resetForms();
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
  
  // 폼 초기화
  const resetForms = () => {
    setIsEditing(false);
    setEditingLog(null);
    setShowAddForm(false);
    setNewLogData({
      nickname: '',
      image_url: '',
      problemCount: '',
      timestamp: new Date().toISOString().slice(0, 16)
    });
    setStatusMessage(null);
  };
  
  // 로그 수정 시작
  const startEditing = (log) => {
    setEditingLog({
      ...log,
      timestamp: new Date(log.timestamp).toISOString().slice(0, 16)
    });
    setIsEditing(true);
    setShowAddForm(false);
  };
  
  // 로그 수정 제출
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingLog || !editingLog.timestamp) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/logs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingLog.timestamp,
          nickname: editingLog.nickname,
          image_url: editingLog.image_url,
          problemCount: editingLog.problemCount ? parseInt(editingLog.problemCount) : null,
          timestamp: new Date(editingLog.timestamp).toISOString()
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // 로그 데이터 다시 불러오기
        const logsResponse = await fetch('/api/logs');
        const logsData = await logsResponse.json();
        
        // 각 로그 항목에 날짜 포맷팅 추가
        const processedData = logsData.map(log => ({
          ...log,
          date: format(parseISO(log.timestamp), 'yyyy-MM-dd'),
          formattedTime: format(parseISO(log.timestamp), 'HH:mm:ss', { locale: ko }),
          formattedDate: format(parseISO(log.timestamp), 'yyyy년 MM월 dd일', { locale: ko })
        }));
        
        setLogs(processedData);
        
        // 선택된 날짜의 로그 업데이트
        if (selectedDate) {
          const filteredLogs = processedData.filter(log => log.date === selectedDate);
          setSelectedDateLogs(filteredLogs);
        }
        
        setStatusMessage({ type: 'success', text: '로그 데이터가 수정되었습니다.' });
        setIsEditing(false);
        setEditingLog(null);
      } else {
        setStatusMessage({ type: 'error', text: data.message || '로그 데이터 수정에 실패했습니다.' });
      }
    } catch (error) {
      console.error('로그 데이터 수정 오류:', error);
      setStatusMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 로그 삭제
  const handleDeleteLog = async (log) => {
    if (!confirm('정말로 이 인증 기록을 삭제하시겠습니까?')) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: log.timestamp
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // 로그 데이터 다시 불러오기
        const logsResponse = await fetch('/api/logs');
        const logsData = await logsResponse.json();
        
        // 각 로그 항목에 날짜 포맷팅 추가
        const processedData = logsData.map(log => ({
          ...log,
          date: format(parseISO(log.timestamp), 'yyyy-MM-dd'),
          formattedTime: format(parseISO(log.timestamp), 'HH:mm:ss', { locale: ko }),
          formattedDate: format(parseISO(log.timestamp), 'yyyy년 MM월 dd일', { locale: ko })
        }));
        
        setLogs(processedData);
        
        // 선택된 날짜의 로그 업데이트
        if (selectedDate) {
          const filteredLogs = processedData.filter(log => log.date === selectedDate);
          setSelectedDateLogs(filteredLogs);
        }
        
        setStatusMessage({ type: 'success', text: '로그 데이터가 삭제되었습니다.' });
      } else {
        setStatusMessage({ type: 'error', text: data.message || '로그 데이터 삭제에 실패했습니다.' });
      }
    } catch (error) {
      console.error('로그 데이터 삭제 오류:', error);
      setStatusMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 로그 추가 폼 표시
  const showNewLogForm = () => {
    setShowAddForm(true);
    setIsEditing(false);
    setNewLogData({
      ...newLogData,
      timestamp: selectedDate ? `${selectedDate}T00:00` : new Date().toISOString().slice(0, 16)
    });
  };
  
  // 로그 추가 처리
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newLogData.nickname || !newLogData.image_url) {
      setStatusMessage({ type: 'error', text: '닉네임과 이미지 URL은 필수 입력 항목입니다.' });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: newLogData.nickname,
          image_url: newLogData.image_url,
          problemCount: newLogData.problemCount ? parseInt(newLogData.problemCount) : null,
          timestamp: new Date(newLogData.timestamp).toISOString()
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // 로그 데이터 다시 불러오기
        const logsResponse = await fetch('/api/logs');
        const logsData = await logsResponse.json();
        
        // 각 로그 항목에 날짜 포맷팅 추가
        const processedData = logsData.map(log => ({
          ...log,
          date: format(parseISO(log.timestamp), 'yyyy-MM-dd'),
          formattedTime: format(parseISO(log.timestamp), 'HH:mm:ss', { locale: ko }),
          formattedDate: format(parseISO(log.timestamp), 'yyyy년 MM월 dd일', { locale: ko })
        }));
        
        setLogs(processedData);
        
        // 선택된 날짜의 로그 업데이트
        if (selectedDate) {
          const filteredLogs = processedData.filter(log => log.date === selectedDate);
          setSelectedDateLogs(filteredLogs);
        }
        
        setStatusMessage({ type: 'success', text: '새 로그 데이터가 추가되었습니다.' });
        setShowAddForm(false);
        setNewLogData({
          nickname: '',
          image_url: '',
          problemCount: '',
          timestamp: new Date().toISOString().slice(0, 16)
        });
      } else {
        setStatusMessage({ type: 'error', text: data.message || '로그 데이터 추가에 실패했습니다.' });
      }
    } catch (error) {
      console.error('로그 데이터 추가 오류:', error);
      setStatusMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={showNewLogForm}
                  className="text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  추가
                </button>
                <button 
                  onClick={() => setShowSidePanel(false)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 상태 메시지 표시 */}
            {statusMessage && (
              <div className={`mb-4 p-3 rounded-lg ${statusMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {statusMessage.text}
              </div>
            )}
            
            {/* 새 로그 추가 폼 */}
            {showAddForm && (
              <div className="bg-dark-700 rounded-lg p-4 mb-4">
                <h3 className="font-medium mb-3 text-primary-300">새 인증 기록 추가</h3>
                <form onSubmit={handleAddSubmit}>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">닉네임</label>
                    <input
                      type="text"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={newLogData.nickname}
                      onChange={(e) => setNewLogData({...newLogData, nickname: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">이미지 URL</label>
                    <input
                      type="text"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={newLogData.image_url}
                      onChange={(e) => setNewLogData({...newLogData, image_url: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">문제 수 (선택사항)</label>
                    <input
                      type="number"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={newLogData.problemCount}
                      onChange={(e) => setNewLogData({...newLogData, problemCount: e.target.value})}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">일시</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={newLogData.timestamp}
                      onChange={(e) => setNewLogData({...newLogData, timestamp: e.target.value})}
                      required
                    />
                  </div>
                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      onClick={() => setShowAddForm(false)}
                      disabled={isSubmitting}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? '처리 중...' : '추가'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {/* 로그 수정 폼 */}
            {isEditing && editingLog && (
              <div className="bg-dark-700 rounded-lg p-4 mb-4">
                <h3 className="font-medium mb-3 text-primary-300">인증 기록 수정</h3>
                <form onSubmit={handleUpdateSubmit}>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">닉네임</label>
                    <input
                      type="text"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={editingLog.nickname}
                      onChange={(e) => setEditingLog({...editingLog, nickname: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">이미지 URL</label>
                    <input
                      type="text"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={editingLog.image_url}
                      onChange={(e) => setEditingLog({...editingLog, image_url: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">문제 수 (선택사항)</label>
                    <input
                      type="number"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={editingLog.problemCount || ''}
                      onChange={(e) => setEditingLog({...editingLog, problemCount: e.target.value})}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">일시</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-dark-600 border border-dark-500 rounded p-2 text-white"
                      value={editingLog.timestamp}
                      onChange={(e) => setEditingLog({...editingLog, timestamp: e.target.value})}
                      required
                    />
                  </div>
                  <div className="flex space-x-2 justify-end">
                    <button
                      type="button"
                      className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? '처리 중...' : '저장'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {/* 해당 날짜의 인증 기록 목록 */}
            {!isEditing && !showAddForm && selectedDateLogs.length > 0 ? (
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
                    
                    {/* 작업 버튼 */}
                    <div className="flex justify-end mt-3 space-x-2">
                      <button 
                        onClick={() => startEditing(log)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        수정
                      </button>
                      <button 
                        onClick={() => handleDeleteLog(log)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isEditing && !showAddForm ? (
              <div className="text-center py-8 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>선택하신 날짜에 인증 내역이 없습니다.</p>
                <button 
                  onClick={showNewLogForm}
                  className="mt-3 px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm flex items-center mx-auto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  이 날짜에 인증 기록 추가하기
                </button>
              </div>
            ) : null}
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