// Discord 봇 시작 스크립트
const { startBot, startBotWithHistoricalData } = require('./bot/discord_bot');

// 명령행 인수 파싱
const args = process.argv.slice(2);
const isHistoricalMode = args.includes('--historical') || args.includes('-h');
let channelId = null;

// 채널 ID 찾기
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--channel' || args[i] === '-c') {
    channelId = args[i + 1];
    break;
  }
}

// 봇 시작
console.log('Discord 봇 시작 중...');

if (isHistoricalMode && channelId) {
  console.log(`이전 데이터 수집 모드로 시작합니다. 대상 채널 ID: ${channelId}`);
  startBotWithHistoricalData(channelId);
} else if (isHistoricalMode) {
  console.error('이전 데이터 수집을 위해서는 채널 ID가 필요합니다.');
  console.log('사용법: node bot-start.js --historical --channel 채널ID');
  process.exit(1);
} else {
  console.log('일반 모드로 시작합니다.');
  startBot();
} 