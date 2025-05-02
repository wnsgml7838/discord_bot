/**
 * /pages/api/webhookImage.js
 * 이미지 업로드 시 Discord 웹훅으로 직접 알림을 보내는 API 엔드포인트
 * Vercel 서버리스 함수로 24/7 동작
 */

import dotenv from 'dotenv';

// 로컬 환경에서 .env 파일 로드 (Vercel 환경에서는 환경 변수 설정 필요)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Discord Webhook URL 설정
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * API 핸들러 함수
 */
export default async function handler(req, res) {
  // POST 메소드만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Webhook URL 확인
    if (!DISCORD_WEBHOOK_URL) {
      return res.status(500).json({ 
        error: 'Discord Webhook URL이 설정되지 않았습니다.',
        env: process.env.NODE_ENV
      });
    }

    // 요청 본문 확인
    const { nickname, image_url, serverId, serverName } = req.body;

    if (!nickname || !image_url) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다. (nickname, image_url)' });
    }

    // IP 주소 (익명화됨)
    const forwardedFor = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ipHash = await hashIP(forwardedFor);

    // 사용자 에이전트
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // 현재 시간
    const timestamp = new Date();
    const kstTimestamp = new Date(timestamp.getTime() + 9 * 60 * 60 * 1000);
    const kstTimestampStr = kstTimestamp.toISOString().replace('T', ' ').substr(0, 19);

    // Discord에 임베드 메시지 보내기
    const embed = {
      title: '🖼️ 새 이미지 업로드',
      color: 0x5865F2, // 디스코드 브랜드 색상 (블루베리)
      description: `사용자 **${nickname}**님이 이미지를 업로드했습니다.`,
      thumbnail: {
        url: image_url
      },
      fields: [
        {
          name: '업로드 시간',
          value: kstTimestampStr,
          inline: true
        },
        {
          name: '서버',
          value: serverName || 'API 요청',
          inline: true
        },
        {
          name: '출처',
          value: serverId || 'API 직접 호출',
          inline: true
        }
      ],
      image: {
        url: image_url
      },
      footer: {
        text: `IP: ${ipHash} • Vercel Serverless`
      },
      timestamp: timestamp.toISOString()
    };

    // Discord Webhook 메시지 구성
    const webhookBody = {
      embeds: [embed]
    };

    // Discord Webhook으로 메시지 전송
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Discord Webhook 전송 실패:', errorData);
      return res.status(500).json({ error: 'Discord Webhook 전송 실패', details: errorData });
    }

    // 성공 응답
    return res.status(200).json({ 
      success: true, 
      message: '이미지가 Discord에 성공적으로 전송되었습니다.', 
      timestamp: timestamp.toISOString() 
    });

  } catch (error) {
    console.error('API 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message
    });
  }
}

/**
 * IP 주소를 해시화하는 도우미 함수 (개인정보 보호)
 */
async function hashIP(ip) {
  try {
    // crypto 모듈 사용
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(ip + process.env.IP_HASH_SALT || 'default-salt');
    return hash.digest('hex').substring(0, 16); // 앞 16자만 사용
  } catch (error) {
    console.error('IP 해싱 오류:', error);
    return 'unknown';
  }
} 