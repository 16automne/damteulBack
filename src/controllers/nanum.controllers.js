const db = require("../db");

exports.create = (req, res) => {
  const { user_id, title, content, status } = req.body;

  const sql = `
    INSERT INTO dam_nanum_posts (user_id, title, content, status, end_nanum) 
    VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 21 HOUR))
  `;

  db.query(sql, [user_id, title, content, status], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "DB 저장 실패" });
    }
    // 생성된 nanum_id 반환
    res.status(200).json({ nanum_id: result.insertId });
  });
};

// 조회하기
exports.findOne = (req, res) => {
  const { nanum_id } = req.params;
  const sql = "SELECT dam_nanum_posts.*, damteul_users.user_nickname,damteul_users.level_code FROM dam_nanum_posts JOIN damteul_users ON dam_nanum_posts.user_id = damteul_users.user_id WHERE dam_nanum_posts.nanum_id =?";

  db.query(sql, [nanum_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(200).json(result[0]);
  });
};

// 데이터 가져오기
exports.findAll = (req, res) => {
  const sql = "SELECT * FROM dam_nanum_posts ORDER BY created_at DESC";

  db.query(sql, (err, result) => {
    if(err){
      console.error(err);
      return res.status(500).json({error:"목록 조회 실패"});
    }
    // DB결과 반환
    res.status(200).json(result);
  });
};

// SQL에 들어갈 이벤트
// -- 1. 이벤트 스케줄러 활성화
// SET GLOBAL event_scheduler = ON;

// -- 2. 기존 이벤트가 있다면 삭제 (중복 방지)
// DROP EVENT IF EXISTS update_nanum_status;

// -- 3. 30분 주기로 변경하여 재생성
// CREATE EVENT update_nanum_status
// ON SCHEDULE EVERY 30 MINUTE
// DO
//   UPDATE dam_nanum_posts 
//   SET status = 1 
//   WHERE end_nanum <= NOW() AND status = 0;

// 응모하기 버튼 클릭시 데이터 POST
exports.apply = (req, res) => {
  const { nanum_id, user_id } = req.body;
  const status = 0;

  const checkSql = "SELECT * FROM dam_nanum_apply WHERE nanum_id=? AND user_id=?";

  db.query(checkSql, [nanum_id, user_id], (err, result) => {
    if (err) return res.status(500).json(err);

    // 1. 중복 확인 결과가 0보다 크면 여기서 중단
    if (result.length > 0) {
      return res.status(400).json({ message: "이미 응모한 게시글입니다." });
    }

    // 2. 중복이 없을 때(result.length === 0) 실행될 INSERT 쿼리를 이 안으로 이동
    const sql = `INSERT INTO dam_nanum_apply (nanum_id, user_id, status) VALUES (?,?,?)`;

    db.query(sql, [nanum_id, user_id, status], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "응모 실패" });
      }
      res.status(200).json({ message: "응모 성공", apply_id: result.insertId });
    });
  });
};