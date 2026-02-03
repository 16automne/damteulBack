const db = require("../db");

exports.create = (req, res) => {
  const { user_id, title, content, status } = req.body;

  const sql = `
    INSERT INTO dam_nanum_posts (user_id, title, content, status, end_nanum) 
    VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))
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

exports.findOne = (req, res) => {
  const { nanum_id } = req.params;
  const sql = "SELECT * FROM dam_nanum_posts WHERE nanum_id = ?";

  db.query(sql, [nanum_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(200).json(result[0]);
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