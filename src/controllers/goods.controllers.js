// backend/src/controllers/goods.controller.js
const db = require("../db");

// ✅ 공통 응답 포맷(간단 버전)
// const ok = (res, data) => res.json({ ok: true, data });
// const fail = (res, status, message) => res.status(status).json({ ok: false, message });

// 예시
// GET /api/goods
// exports.list = (req, res, next) => {
//   const sql = "SELECT * FROM goods ORDER BY g_code DESC";
//   db.query(sql, (err, rows) => {
//     if (err) return next(err);
//     return ok(res, rows);
//   });
// };

// 글쓰기
exports.create = (req, res) =>{
	// formData에서 보낸값
	const {
		user_id,
		category_id,
		title,
		content, 
		price, 
		conversation_type, 
		condition_type,
		defect_note,
		status} = req.body;

	// 일단 이미지없으면 null처리 추후변경예정
	//(여러 장일 경우 파일명들을 배열로 받음)
	const image_files = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
	console.log("업로드된 이미지들:", image_files);


	const sql = `
	INSERT INTO dam_goods_posts 
	(user_id, category_id, title, content, price, conversation_type,   condition_type, defect_note, status)
	VALUES (?,?,?,?,?,?,?,?,?)`;

	const params =[
		user_id,
		Number(category_id),
    title, 
    content, 
    Number(price), 
		conversation_type, 
    condition_type, 
    defect_note, 
    status
	];

	db.query(sql,params, (err, result)=>{
		if(err){
			console.error("SQL error : ", err);

			console.error("===== SQL 에러 발생 =====");
    console.error("에러코드:", err.code);
    console.error("에러메시지:", err.sqlMessage);
    console.error("실행하려던 SQL:", err.sql);
    console.error("=========================");
			return res.status(500).json({ok:false, message:"DB 저장 실패"});
		}
		// 성공 시 생성된 goods_id반환
		res.json({ok:true, id:result.insertId});
	});
};

// 작성한 게시글 게시하기
exports.post = (req, res) => {
	const sql = `SELECT * FROM dam_goods_posts ORDER BY created_at DESC`;

	db.query(sql, (err, results)=>{
		if(err){
			return res.status(500).json({ok:false, message:"조회 실패"});
		}
		res.json({ok:true, list:results});
	});
};

// GoodsDetail 상세페이지에 띄울 정보 조회하기
exports.findOne = (req, res) => {
  const { goods_id } = req.params;
  // damteul_users 테이블에서 닉네임만 가져와 가상테이블로 합침
	const sql = `
    SELECT dam_goods_posts.*, damteul_users.user_nickname 
    FROM dam_goods_posts 
    LEFT JOIN damteul_users ON dam_goods_posts.user_id = damteul_users.user_id 
    WHERE dam_goods_posts.goods_id = ?
  `;

  db.query(sql, [goods_id], (err, result) => {
    if (err) return res.status(500).json({ ok: false });
    res.json({ ok: true, data: result[0] });
  });
};