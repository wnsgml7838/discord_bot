# Discord Bot 대시보드

이 프로젝트는 Discord 봇을 통해 코딩 테스트 인증 스터디 활동을 기록하고, 웹 대시보드를 통해 조회할 수 있는 시스템입니다.

## 주요 기능

1. Discord 채널에서 스터디 참여 인증 이미지 자동 수집
2. 백준 문제 추천 기능
3. 스터디 참여 현황 달력 뷰
4. 통계 및 분석 대시보드

## 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/wnsgml7838/discord_bot.git
cd discord_bot

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```
DISCORD_TOKEN=your_discord_bot_token
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=wnsgml7838
GITHUB_REPO=discord_bot
MONITORED_CHANNEL_IDS=channel_id1,channel_id2
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

## Vercel 배포

이 프로젝트는 Vercel에 자동 배포됩니다. GitHub 저장소에 변경사항을 푸시하면 자동으로 배포 프로세스가 시작됩니다.

### Vercel Hobby 플랜 제한 사항

현재 이 프로젝트는 Vercel Hobby 플랜에 맞춰 최적화되었습니다:

- **cron job 실행 제한**: Hobby 플랜에서는 계정당 최대 2개의 cron job이 **하루에 한 번**만 실행됩니다.
- **cron job 실행 시간 불확실성**: 지정된 시간에서 최대 59분 내에 실행될 수 있습니다.
- **현재 설정**:
  - `/api/cron-logger`: 매일 정오(12:00)에 서버 상태 보고
  - `/api/discord-log-sync-simple`: 매일 자정(00:00)에 로그 동기화

더 자주 cron job을 실행하려면 Vercel Pro 플랜으로 업그레이드하세요.

### 배포 문제 해결

Vercel 배포가 제대로 되지 않는 경우 다음 단계를 시도해보세요:

1. Vercel 대시보드에서 배포 로그 확인
2. 환경 변수가 올바르게 설정되었는지 확인
3. GitHub 저장소의 프로젝트 구조가 Vercel과 호환되는지 확인
4. `vercel.json` 설정 파일 검증
5. 필요한 경우 Vercel 대시보드에서 수동 재배포 시도

## API 엔드포인트

### Discord Bot 관련

- `/api/test-webhook` - Discord 웹훅 테스트
- `/api/discord-log-sync-simple` - 일일 로그 동기화 (매일 자정)
- `/api/discord-log-sync-debug` - 로그 동기화 디버깅
- `/api/test-direct` - 간단한 상태 확인 API
- `/api/simple-check` - 서버 상태 체크

### 문제 추천 관련

- `/api/recommend` - 백준 문제 추천
- `/api/recommend-discord` - Discord 봇용 문제 추천

### 활동 로그 관련

- `/api/log-activity` - 활동 로그 기록
- `/api/logs` - 로그 조회
- `/api/cron-logger` - 일일 서버 상태 보고 (매일 정오)

## 기술 스택

- Next.js
- Discord.js
- Node.js
- GitHub API (Octokit)
- Chart.js
- Tailwind CSS

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
