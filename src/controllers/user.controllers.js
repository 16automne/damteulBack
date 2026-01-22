// /controllers/userController.js (예시 경로)
const connection = require("../db");

exports.register = (req, res) => {
  const { user_name, user_nickname, user_phone } = req.body;
  const errors = {}; // 에러를 담을 객체

  // 1. 서버 유효성 검사 (필수 값)
  if (!user_name) errors.user_name = '이름을 입력해주세요.';
  if (!user_nickname) errors.user_nickname = '닉네임을 입력해주세요.';
  if (!user_phone) errors.user_phone = '전화번호를 입력해주세요.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', errors });
  }

  // 2. 중복 체크 (OR 조건으로 한 번에 조회)
  const checkQuery = `
    SELECT user_phone, user_nickname 
    FROM damteul_users 
    WHERE user_phone = ? OR user_nickname = ?
  `;

  connection.query(checkQuery, [user_phone, user_nickname], (err, results) => {
    if (err) {
      return res.status(500).json({ code: 'DB_ERROR', message: 'DB 오류 발생' });
    }

    // 중복 검사 로직
    if (results.length > 0) {
      results.forEach(row => {
        if (row.user_phone === user_phone) errors.user_phone = '이미 사용 중인 전화번호입니다.';
        if (row.user_nickname === user_nickname) errors.user_nickname = '이미 사용 중인 닉네임입니다.';
      });
    }

    // 에러가 하나라도 있으면 즉시 반환 (중복 포함)
    if (Object.keys(errors).length > 0) {
      return res.status(409).json({ code: 'DUPLICATE_ERROR', errors });
    }

    // 3. 삽입 쿼리
    const insertQuery = `INSERT INTO damteul_users (user_name, user_nickname, user_phone) VALUES (?, ?, ?)`;
    connection.query(insertQuery, [user_name, user_nickname, user_phone], (err2) => {
      if (err2) {
        return res.status(500).json({ code: 'DB_ERROR', message: '저장 중 오류 발생' });
      }
      return res.status(201).json({ ok: true });
    });
  });
};