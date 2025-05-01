/**
 * 백준 문제 추천 기능 - Discord 봇 연동
 * Python 스크립트를 호출하여 백준 문제를 추천합니다.
 */

const { exec } = require('child_process');
const path = require('path');

/**
 * 백준 아이디로 문제 추천 
 * @param {string} handle - 백준 아이디
 * @returns {Promise<string>} - 추천 결과 메시지
 */
function recommendBaekjoonProblems(handle) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'commands', 'baekjoon_recommender.py');
    
    console.log(`백준 문제 추천 시작: ${handle}`);
    console.log(`실행 경로: python ${scriptPath} ${handle}`);
    
    exec(`python ${scriptPath} ${handle}`, (error, stdout, stderr) => {
      if (error) {
        console.error('백준 문제 추천 오류:', error.message);
        console.error('STDERR:', stderr);
        return reject('백준 문제 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      
      if (stderr) {
        console.warn('백준 문제 추천 경고:', stderr);
      }
      
      console.log('백준 문제 추천 완료');
      return resolve(stdout);
    });
  });
}

module.exports = { recommendBaekjoonProblems }; 