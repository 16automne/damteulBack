// backend/src/controllers/goods.controller.js
const db = require("../db");

// ✅ 공통 응답 포맷(간단 버전)
const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, status, message) => res.status(status).json({ ok: false, message });

// 예시
// GET /api/goods
// exports.list = (req, res, next) => {
//   const sql = "SELECT * FROM goods ORDER BY g_code DESC";
//   db.query(sql, (err, rows) => {
//     if (err) return next(err);
//     return ok(res, rows);
//   });
// };