/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 정적 에셋을 위한 설정
  images: {
    domains: ['cdn.discordapp.com'], // Discord 이미지 URL 도메인 허용
  },
  // 환경 변수 추가
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO,
  },
  // 서버 사이드 환경변수 설정
  serverRuntimeConfig: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO,
  },
  // 공용 런타임 설정
  publicRuntimeConfig: {
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO,
  }
}

module.exports = nextConfig 