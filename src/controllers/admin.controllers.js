const connection = require("../db");

// 대쉬보드 정보가져오기
// /api/admin/dashboard
exports.dashboard = (req, res) => {
  // 1) KPI (오늘/이번달 가입/신고/게시물)
  const kpiQuery = `
    SELECT
      (SELECT COUNT(*) FROM damteul_users WHERE DATE(created_at) = CURDATE()) AS today_users,
      (SELECT COUNT(*) FROM dam_reports WHERE DATE(created_at) = CURDATE()) AS today_reports,
      (SELECT COUNT(*) FROM dam_goods_posts WHERE DATE(created_at) = CURDATE()) AS today_goods_posts,
      (SELECT COUNT(*) FROM dam_nanum_posts WHERE DATE(created_at) = CURDATE()) AS today_nanum_posts,

      (SELECT COUNT(*) FROM damteul_users WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS month_users,
      (SELECT COUNT(*) FROM dam_reports WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS month_reports,
      (SELECT COUNT(*) FROM dam_goods_posts WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS month_goods_posts,
      (SELECT COUNT(*) FROM dam_nanum_posts WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())) AS month_nanum_posts
  `;

  // 2) 일자별 요약 (최근 7일)
  const summaryQuery = `
    SELECT
      DATE_FORMAT(d.date, '%Y-%m-%d') AS date,
      IFNULL(u.users, 0) AS users,
      IFNULL(r.reports, 0) AS reports,
      IFNULL(p.posts, 0) AS posts
    FROM (
      SELECT CURDATE() - INTERVAL n DAY AS date
      FROM (
        SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
        SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
      ) nums
    ) d
    LEFT JOIN (
      SELECT DATE(created_at) AS d, COUNT(*) AS users
      FROM damteul_users
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(created_at)
    ) u ON u.d = DATE(d.date)
    LEFT JOIN (
      SELECT DATE(created_at) AS d, COUNT(*) AS reports
      FROM dam_reports
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(created_at)
    ) r ON r.d = DATE(d.date)
    LEFT JOIN (
      SELECT d, COUNT(*) AS posts
      FROM (
        SELECT DATE(created_at) AS d
        FROM dam_nanum_posts
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY

        UNION ALL

        SELECT DATE(created_at) AS d
        FROM dam_goods_posts
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      ) x
      GROUP BY d
    ) p ON p.d = DATE(d.date)
    ORDER BY DATE(d.date) DESC;
  `;

  // 3) 이벤트/공지 최근 N개
  // ✅ 너가 실제 컬럼명으로 수정했다고 했으니, 그 컬럼명 기준으로 유지해줘.
  // 예시: event_id, title, cate, created_at
  const eventsQuery = `
    SELECT event_id, title, cate, DATE(created_at) AS date
    FROM dam_event_notice
    ORDER BY created_at DESC
    LIMIT 5
  `;

  // --- KPI 쿼리 실행 ---
  connection.query(kpiQuery, (err, kpiRows) => {
    if (err) {
      console.error("KPI query error:", err);
      return res.status(500).json({
        message: "대시보드 KPI 조회 실패",
        detail: err.sqlMessage || err.message,
        code: err.code || null,
      });
    }

    const k = kpiRows?.[0] || {};
    const dPosts = (k.today_goods_posts ?? 0) + (k.today_nanum_posts ?? 0);
    const mPosts = (k.month_goods_posts ?? 0) + (k.month_nanum_posts ?? 0);

    const kpiData = {
      today: {
        users: k.today_users ?? 0,
        reports: k.today_reports ?? 0,
        posts: dPosts,
      },
      month: {
        users: k.month_users ?? 0,
        reports: k.month_reports ?? 0,
        posts: mPosts,
      },
    };

    // --- SUMMARY 쿼리 실행 ---
    connection.query(summaryQuery, (err, summaryRows) => {
      if (err) {
        console.error("SUMMARY query error:", err);
        return res.status(500).json({
          message: "대시보드 요약 조회 실패",
          detail: err.sqlMessage || err.message,
          code: err.code || null,
        });
      }

      const summaryData = (summaryRows || []).map((row) => ({
        date: row.date,
        users: row.users ?? 0,
        reports: row.reports ?? 0,
        posts: row.posts ?? 0,
      }));

      // --- EVENTS 쿼리 실행 ---
      connection.query(eventsQuery, (err, eventsRows) => {
        if (err) {
          console.error("EVENTS query error:", err);
          return res.status(500).json({
            message: "대시보드 이벤트/공지 조회 실패",
            detail: err.sqlMessage || err.message,
            code: err.code || null,
          });
        }

        const eventsData = (eventsRows || []).map((row) => ({
          id: row.event_id,
          title: row.title,
          type: row.cate, // '이벤트' | '공지사항' 등
          date: String(row.date).slice(0, 10),
        }));

        // ✅ 모든 데이터 준비 완료 → 한번에 응답
        return res.json({ kpiData, summaryData, eventsData });
      });
    });
  });
};


// 유저정보 가져오기
//api/admin/users
exports.users = (req, res)=>{
  const getUsersInfo = `
    SELECT user_id, user_nickname, level_code, reported_count, status, created_at From damteul_users
  `;
  connection.query(getUsersInfo,(err,result)=>{
    if(err){
      console.error("users 조회 오류: ", err);
      return res.status(500).json({
        success:false,
        message: "사용자 정보를 불러오는 중 오류가 발생했습니다.",
        error: err.message, //개발용
      });
    }

    return res.status(200).json({
      success: true,
      message: "사용자 목록 조회 성공",
      users: result, // 결과값
    })
  });
};


// 유저 상세
// 1. 유저 상세 조회
// /api/admin/users/:user_id
exports.getUserDetail = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({
      success: false,
      message: "user_id가 전달되지 않았습니다.",
    });
  }

  const sql = `
    SELECT
      user_id,
      user_nickname,
      level_code,
      reported_count,
      status,
      created_at
    FROM damteul_users
    WHERE user_id = ?
    LIMIT 1
  `;

  connection.query(sql, [user_id], (err, rows) => {
    if (err) {
      console.error("유저 상세 조회 SQL 에러:", err);
      return res.status(500).json({
        success: false,
        message: "유저 상세 조회 중 서버 오류",
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 user_id 유저를 찾을 수 없습니다.",
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0],
    });
  });
};

// 삭제
exports.delete = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "id가 전달되지 않았습니다.",
    });
  }

  const sql = `
    DELETE FROM damteul_users
    WHERE user_id = ?
  `;

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("삭제 SQL 에러:", err);
      return res.status(500).json({
        success: false,
        message: "삭제 중 서버 오류",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "삭제할 정보를 찾을 수 없습니다.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "삭제 완료",
      user_id,
    });
  });
};