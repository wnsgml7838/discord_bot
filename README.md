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
```

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
