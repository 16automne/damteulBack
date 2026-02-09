// backend/src/controllers/admin.noticeEvent.controllers.js
const connection = require("../db");

// 공통 에러 응답 헬퍼
function serverError(res, error, message = "서버 오류") {
  console.error(error);
  return res.status(500).json({ success: false, message });
}


function syncEventStatus(cb) {
  const syncSql = `
    UPDATE dam_event_notice
    SET status = CASE
      WHEN NOW() < start_date THEN 1   -- 예정
      WHEN NOW() > end_date   THEN 2   -- 종료
      ELSE 0                            -- 진행중
    END
  `;

  connection.query(syncSql, (err) => cb(err));
}

/**
 * GET /api/admin/events
 * cate=0 이벤트 목록
 * 프론트: data.events 를 우선으로 읽음
 */
exports.getAdminEvents = (req, res) => {
  syncEventStatus((err) => {
    if (err) {
      console.error("syncEventStatusById error:", err);
      return res.status(500).json({ success: false, message: "서버 오류(status 갱신 실패)" });
    }
    const sql = `
      SELECT
        event_id AS id,
        title,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
        CASE status
          WHEN 0 THEN '예정'
          WHEN 1 THEN '진행중'
          WHEN 2 THEN '종료'
        END AS status
      FROM dam_event_notice
      WHERE cate = 0
      ORDER BY event_id DESC
    `;

    connection.query(sql, (err, rows) => {
      if (err) return serverError(res, err, "이벤트 조회 실패");
      return res.json({ success: true, events: rows || [] });
    });
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



/**
 * GET /api/admin/event/:id
 * 이벤트 상세 (status 컬럼을 실제로 갱신 후 내려줌)
 */
exports.getEventDetail = (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "유효하지 않은 ID" });

  // 1) status 동기화
  syncEventStatus((err) => {
    if (err) {
      console.error("syncEventStatusById error:", err);
      return res.status(500).json({ success: false, message: "서버 오류(status 갱신 실패)" });
    }

    // 2) 상세 조회
    const selectSql = `
      SELECT
        event_id AS id,
        title,
        content,
        image,
        start_date AS startDate,
        end_date   AS endDate,
        CASE status
          WHEN 0 THEN '예정'
          WHEN 1 THEN '진행중'
          WHEN 2 THEN '종료'
        END AS status
      FROM dam_event_notice
      WHERE event_id = ?
    `;

    connection.query(selectSql, [id], (err2, rows) => {
      if (err2) {
        console.error("getEventDetail error:", err2);
        return res.status(500).json({ success: false, message: "서버 오류(이벤트 조회 실패)" });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: "이벤트가 존재하지 않습니다." });
      }

      return res.json({ success: true, event: rows[0] });
    });
  });
};


// 이벤트 업데이트
exports.updateEvent = (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "유효하지 않은 ID" });

  const { title, content, image, startDate, endDate } = req.body;

  if (!title?.trim()) return res.status(400).json({ success: false, message: "제목이 없습니다." });
  if (!content?.trim()) return res.status(400).json({ success: false, message: "내용이 없습니다." });
  if (!image?.trim()) return res.status(400).json({ success: false, message: "이미지가 없습니다." });
  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, message: "날짜가 올바르지 않습니다." });
  }
  if (String(endDate) < String(startDate)) {
    return res.status(400).json({ success: false, message: "종료일은 시작일보다 빠를 수 없습니다." });
  }

  const updateSql = `
    UPDATE dam_event_notice
    SET
      title = ?,
      content = ?,
      image = ?,
      start_date = ?,
      end_date = ?,
      status = CASE
        WHEN NOW() < ? THEN 1  -- 예정 (NOW < startDate)
        WHEN NOW() > ? THEN 2  -- 종료 (NOW > endDate)
        ELSE 0                  -- 진행중
      END
    WHERE event_id = ?
  `;

  // NOW() < startDate / NOW() > endDate 비교를 위해 파라미터로 startDate/endDate를 한번 더 넣음
  connection.query(
    updateSql,
    [title, content, image, startDate, endDate, startDate, endDate, id],
    (err, result) => {
      if (err) {
        console.error("updateEvent error:", err);
        return res.status(500).json({ success: false, message: "서버 오류(이벤트 수정 실패)" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "수정할 이벤트가 없습니다." });
      }

      return res.json({ success: true, message: "이벤트 수정 완료" });
    }
  );
};

/**
 * DELETE /api/admin/events/:id
 */
exports.deleteEvent = (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "유효하지 않은 ID" });

  const sql = `DELETE FROM dam_event_notice WHERE event_id = ?`;

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("deleteEvent error:", err);
      return res.status(500).json({ success: false, message: "서버 오류(이벤트 삭제 실패)" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "삭제할 이벤트가 없습니다." });
    }

    return res.json({ success: true, message: "이벤트 삭제 완료" });
  });
};
