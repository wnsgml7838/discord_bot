// 간단한 API 상태 체크 엔드포인트

module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API가 정상적으로 작동 중입니다.',
    timestamp: new Date().toISOString()
  });
}; 