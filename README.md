# 디스코드 인증 봇

## 환경 변수 설정

이 프로젝트는 다음 환경 변수를 사용합니다:

1. `.env` 파일을 프로젝트 루트 디렉토리에 생성하세요
2. `.env.example` 파일을 참고하여 필요한 환경 변수를 설정하세요

```
DISCORD_TOKEN=your_discord_token_here
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here
API_CRON_SECRET=your_api_cron_secret_here
```

## Discord Webhook URL 설정 방법

1. Discord 서버 관리자 패널에서 "웹후크" 메뉴로 이동합니다.
2. "새 웹후크" 버튼을 클릭합니다.
3. 웹후크 이름과 채널을 설정합니다.
4. "웹후크 URL 복사" 버튼을 클릭하여 URL을 복사합니다.
5. 이 URL을 `.env` 파일의 `DISCORD_WEBHOOK_URL`에 붙여넣습니다.

## Vercel 배포 시 추가 환경 변수 설정

Vercel에 배포할 때 다음 환경 변수를 추가로 설정하세요:

- `DISCORD_WEBHOOK_URL`: Discord에 로그를 전송하기 위한 웹후크 URL
- `API_CRON_SECRET`: 크론 작업에 대한 인증을 위한 비밀 키 (임의의 복잡한 문자열 설정)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# Discord 봇 시작
node bot-start.js

# Next.js 애플리케이션 실행
npm run dev
```

## 배포 시 환경 변수 설정

- Vercel에 배포할 경우 Vercel 대시보드에서 환경 변수를 설정하세요
- 다른 서버에 배포할 경우 해당 서버에 `.env` 파일을 생성하거나 환경 변수를 설정하세요

# Discord 봇 대시보드

디스코드 봇을 이용한 학습 인증 및 통계 대시보드

## 기능

- 디스코드 채팅방에 이미지를 공유하면 자동으로 기록
- 사용자별, 날짜별 인증 횟수 통계
- 요일별, 시간대별 인증 패턴 분석
- 시각화된 차트를 통한 통계 제공
- **백준 알고리즘 문제 추천 기능**

## 새로운 기능: 백준 문제 추천

디스코드 채팅방에서 다음 명령어를 사용하여 백준 문제를 추천받을 수 있습니다:

```
!백준추천 [백준ID]
```

또는

```
!문제추천 [백준ID]
```

이 기능은 사용자가 최근에 푼 10개의 문제를 분석하여 유사한 태그의 문제를 추천해줍니다.

### 필요 조건

- Python 3.6 이상
- Python 라이브러리: requests

Python 라이브러리 설치:
```
pip install -r requirements.txt
```

## 설치 방법

1. 저장소 클론하기
```
git clone https://github.com/wnsgml7838/discord_bot.git
cd discord_bot
```

2. npm 패키지 설치
```
npm install
```

3. `.env` 파일 설정
```
DISCORD_TOKEN=your_discord_token
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=discord_bot
```

4. 봇 실행
```
node bot-start.js
```

5. 과거 메시지 수집 모드
```
node bot-start.js --historical --channel <channel_id>
```

## 기술 스택

- Next.js
- Discord.js
- Chart.js
- Tailwind CSS
- Python (백준 문제 추천 기능)

## 라이센스

MIT
