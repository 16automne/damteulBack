// user관련 작업

const connection = require("../db");


// 회원가입
// /api/user/register
exports.register = (req, res) =>{
  const { user_name ,user_nickname, user_phone }= req.body;

  // 1. 서버 유효성 검사
  if(!user_name || !user_nickname || !user_phone){
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '필수 값이 누락되었습니다.',
    });
  }

  // 2. 중복 체크 쿼리문
  const checkRes = `
    SELECT user_phone, user_nickname
    FROM damteul_users
    WHERE user_phone = ? OR user_nickname = ?
    LIMIT 1
  `;
  
  // 3. 쿼리 돌리기
  connection.query(checkRes,[user_phone,user_nickname],(err,result)=>{
      if (err) {
        return res.status(500).json({
          code: 'DB_ERROR',
          message: 'DB 오류가 발생했습니다.'
        });
      }
      // 값이 있는경우
      if (result.length > 0){
        const row = result[0];

        // 전화번호 중복
        if (row.user_phone === user_phone){
          return res.status(409).json({
            code: 'DUPLICATE_PHONE',
            message: '이미 사용 중잉 전화번호입니다.',
          });
        }

        // 닉네임 중복
        if (row.user_nickname === user_nickname){
          return res.status(409).json({
            code: 'DUPLICATE_NICKNAME',
            message: '이미 사용 중인 닉네임입니다.',
          });
        }
      }

      // 3. 중복 아니면 insert
      const insertRes = `
        INSERT INTO damteul_users (user_name, user_nickname, user_phone)
        VALUES (?, ?, ?)      
      `;

      // 쿼리문 돌리기
      connection.query(insertRes, [user_name, user_nickname, user_phone],(err2,result2)=>{
        // 에러 발생시
        if(err2){
          //UNIQUE 걸어둔 경우 여기로도 중복이 들어올 수 있으니 한 번 더 방어
          if(err2.code === 'ER_DUP_ENTRY'){
            return res.status(409).json({
              code: 'DUPLICATE',
              message: '이미 사용 중인 값이 있습니다.',
            });
          }
          return res.status(500).json({
            code: 'DB_ERROR',
            message: '회원가입 저장 중 오류가 발생했습니다.',
          });
        }

        return res.status(201).json({
          ok: true,
          // user_id: result2.insetId,
        });
      });
    }
  )
}
