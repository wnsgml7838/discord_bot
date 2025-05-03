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
  },
  // CORS 헤더 설정
  async headers() {
    return [
      {
        // 모든 API 경로에 대해 CORS 헤더 설정
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  experimental: {
    // Vercel에서의 빌드 성능 최적화
    optimizeCss: true,
    scrollRestoration: true,
  },
  swcMinify: true, // Rust 기반 SWC 컴파일러 사용
  poweredByHeader: false, // X-Powered-By 헤더 제거
  onDemandEntries: {
    // 개발 서버 최적화 설정
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  typescript: {
    // 프로덕션 빌드시 타입 체크 건너뛰기 (CI/CD에서는 별도 타입 체크 단계 권장)
    ignoreBuildErrors: true,
  },
  eslint: {
    // 프로덕션 빌드시 ESLint 체크 건너뛰기 (CI/CD에서는 별도 검사 단계 권장)
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 