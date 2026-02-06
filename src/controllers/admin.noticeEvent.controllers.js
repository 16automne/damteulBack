// backend/src/controllers/admin.noticeEvent.controllers.js
const connection = require("../db");

// 공통 에러 응답 헬퍼
function serverError(res, error, message = "서버 오류") {
  console.error(error);
  return res.status(500).json({ success: false, message });
}

/**
 * GET /api/admin/events
 * cate=0 이벤트 목록
 * 프론트: data.events 를 우선으로 읽음
 */
exports.getAdminEvents = (req, res) => {
  const sql = `
    SELECT
      event_id AS id,
      title,
      DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
      DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
      CASE status
        WHEN 0 THEN '진행중'
        WHEN 1 THEN '예정'
        WHEN 2 THEN '종료'
      END
    FROM dam_event_notice
    WHERE cate = 0
    ORDER BY event_id DESC
  `;

  connection.query(sql, (err, rows) => {
    if (err) return serverError(res, err, "이벤트 조회 실패");
    return res.json({ success: true, events: rows || [] });
  });
};

/**
 * GET /api/admin/notices
 * cate=1 공지사항 목록
 * 프론트: data.notices 를 우선으로 읽음
 */
exports.getAdminNotices = (req, res) => {
  const sql = `
    SELECT
      event_id AS id,
      title,
      DATE_FORMAT(created_at, '%Y-%m-%d') AS postDate
    FROM dam_event_notice
    WHERE cate = 1
    ORDER BY event_id DESC
  `;

  connection.query(sql, (err, rows) => {
    if (err) return serverError(res, err, "공지사항 조회 실패");
    return res.json({ success: true, notices: rows || [] });
  });
};
