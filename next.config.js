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
  // 기본 최적화 설정
  swcMinify: true,
  poweredByHeader: false,
}

export default nextConfig; 