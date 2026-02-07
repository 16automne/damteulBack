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

	//이미지 받아오기
	const image_url = req.files ? req.files.map(f => `/uploads/${f.filename}`).join(',') : '';
	console.log("DB에 저장될 이미지 경로:", image_url);


	const sql = `
  INSERT INTO dam_goods_posts 
  (user_id, category_id, title, content, price, conversation_type, condition_type, defect_note, status)
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
		const goods_id = result.insertId;

		// dam_goods_images테이블에 이미지 저장
		if(req.files && req.files.length > 0){
			const imageSql = `
        INSERT INTO dam_goods_images (goods_id, image_url, condition_type) 
        VALUES ?
      `;
			const imageParams = req.files.map(f => [
        goods_id,
        `/uploads/${f.filename}`,
        condition_type
      ]);

      db.query(imageSql, [imageParams], (imgErr) => {
        if (imgErr) {
          console.error("이미지 저장 에러:", imgErr.sqlMessage);
          // 이미지 저장 실패 시에도 일단 게시글 ID는 반환 (필요에 따라 조절)
        }
        res.json({ ok: true, id: goods_id });
      });
    } else {
      res.json({ ok: true, id: goods_id });
		}
	});
};

// 작성한 게시글 게시하기
exports.post = (req, res) => {
	const sql = `
    SELECT 
      dam_goods_posts.*, 
      (SELECT COUNT(*) FROM dam_goods_likes WHERE dam_goods_likes.goods_id = dam_goods_posts.goods_id AND dam_goods_likes.status = 1) AS like_count 
    FROM dam_goods_posts 
    ORDER BY dam_goods_posts.created_at DESC
  `;

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
	const {user_id} = req.query;
  // damteul_users 테이블에서 닉네임만 가져와 가상테이블로 합침
	const sql = `
    SELECT dam_goods_posts.*, damteul_users.user_nickname,
		(SELECT COUNT(*) FROM dam_goods_likes WHERE dam_goods_likes.goods_id = dam_goods_posts.goods_id AND dam_goods_likes.status=1) AS like_count,
		(SELECT status FROM dam_goods_likes WHERE dam_goods_likes.goods_id = dam_goods_posts.goods_id AND dam_goods_likes.user_id = ?) AS like_status
    FROM dam_goods_posts 
    LEFT JOIN damteul_users ON dam_goods_posts.user_id = damteul_users.user_id 
    WHERE dam_goods_posts.goods_id = ?
  `;

  db.query(sql, [user_id || null, goods_id], (err, result) => {
    if (err) {
			console.error("상세 조회 에러 : ", err);
			return res.status(500).json({ ok: false });
		}
    const data = result[0];

		// GoodsDetail하단 관련상품조회 동일카테고리,현재상품제외, 랜덤4개
		const relevanceSql = `
		SELECT * FROM dam_goods_posts
		WHERE category_id=? AND goods_id !=?
		ORDER BY RAND()
		LIMIT 4`;

		db.query(relevanceSql,[data.category_id,goods_id], (err,results) => {
			if(err){
				console.error("관련 상품 조회 에러 :", err);
				return res.status(500).json({ok:false});
			}
			res.json({
				ok: true,
				data:data,
				relevance:results
			});
		});
  });
};

// 게시글 삭제
exports.remove = (req, res) => {
  const { goods_id } = req.params;
  const sql = `DELETE FROM dam_goods_posts WHERE goods_id = ?`;

  db.query(sql, [goods_id], (err, result) => {
    if (err) {
      console.error("삭제 에러:", err);
      return res.status(500).json({ ok: false, message: "삭제 실패" });
    }
    
    // 영향을 받은 행(row)이 있다면 성공
    if (result.affectedRows > 0) {
      res.json({ ok: true, message: "삭제 성공" });
    } else {
      res.status(404).json({ ok: false, message: "게시글을 찾을 수 없습니다." });
    }
  });
};

// 좋아요 버튼 클릭 시 토글
exports.toggleLike =(req, res) => {
	const {goods_id, user_id} = req.body;
	console.log("전송받은 데이터:", { goods_id, user_id });
	// 좋아요 이전에 눌렀었는지 확인
	const checkSql = `SELECT * FROM dam_goods_likes WHERE goods_id = ? AND user_id = ?`;

	db.query(checkSql, [goods_id, user_id],(err, results)=>{
		if(err) {
			console.error("체크 쿼리 에러:", err);
			return res.status(500).json({ok: false});
		}
		if(results.length > 0){
			// 이미 존재시 status반전
			const newStatus = results[0].status === 1? 0:1;
			const updateSql = `UPDATE dam_goods_likes SET status =? WHERE goods_id=? AND user_id=?`;
			db.query(updateSql, [newStatus, goods_id, user_id],(err)=>{
				if(err) return res.status(500).json({ok:false});
				res.json({ok:true, status:newStatus});
			});
		}else{
			// 처음 누를 시 status 1로 생성
			const insertSql = `INSERT INTO dam_goods_likes(goods_id, user_id, status) VALUES (?,?,1)`;

			db.query(insertSql, [goods_id, user_id],(err)=>{
				if(err)return res.status(500).json({ok:false});
				res.json({ok:true,status:1});
			});
		}
	});
};