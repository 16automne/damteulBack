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
exports.create = (req, res) => {
  const {
    user_id,
    category_id,
    title,
    content,
    price,
    images, // 프론트에서 넘어온 객체 배열
    conversation_type,
    condition_type,
    defect_note,
    status
  } = req.body;

  const sql = `
  INSERT INTO dam_goods_posts 
  (user_id, category_id, title, content, price, conversation_type, condition_type, defect_note, status)
  VALUES (?,?,?,?,?,?,?,?,?)`;

  const params = [
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

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("SQL error : ", err);
      return res.status(500).json({ ok: false, message: "DB 저장 실패" });
    }
    const goods_id = result.insertId;

    // ✅ 이미지 처리 로직 수정
    if (images && (Array.isArray(images) || (typeof images === 'string' && images.length > 0))) {
      let imageList = [];
      
      if (Array.isArray(images)) {
        // 객체 배열이면 url만 추출, 아니면 그대로
        imageList = images.map(img => (typeof img === 'object' ? img.url : img));
      } else {
        // 문자열이면 split
        imageList = images.split(',');
      }

      const imageSql = `
        INSERT INTO dam_goods_images (goods_id, image_url, condition_type) 
        VALUES ?
      `;

      // 데이터 정제: [object Object] 방지 및 문자열 강제 변환
      const imageParams = imageList
        .filter(url => url && String(url).indexOf('[object Object]') === -1)
        .map(url => [
          goods_id,
          String(url).trim(),
          condition_type
        ]);

      if (imageParams.length > 0) {
        db.query(imageSql, [imageParams], (imgErr) => {
          if (imgErr) console.error("이미지 저장 에러:", imgErr.sqlMessage);
          return res.json({ ok: true, id: goods_id });
        });
      } else {
        return res.json({ ok: true, id: goods_id });
      }
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
      (SELECT image_url FROM dam_goods_images WHERE dam_goods_images.goods_id = dam_goods_posts.goods_id LIMIT 1) AS image,
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
	const sql =  `
    SELECT 
      dam_goods_posts.*, 
      damteul_users.user_nickname, 
      damteul_users.profile,
      (SELECT COUNT(*) FROM dam_goods_likes WHERE goods_id = dam_goods_posts.goods_id AND status=1) AS like_count,
      (SELECT status FROM dam_goods_likes WHERE goods_id = dam_goods_posts.goods_id AND user_id = ?) AS like_status
    FROM dam_goods_posts 
    LEFT JOIN damteul_users ON dam_goods_posts.user_id = damteul_users.user_id 
    WHERE dam_goods_posts.goods_id = ?
  `;

  db.query(sql, [user_id || null, goods_id], (err, result) => {
    if (err || result.length === 0) {
			console.error("상세 조회 에러 : ", err);
			return res.status(500).json({ ok: false });
		}
    const data = result[0];

		// 이미지 따로 조회
		const imageSql = `
		SELECT image_url
		FROM dam_goods_images
		WHERE goods_id = ?`;

		db.query(imageSql, [goods_id], (imgErr, images)=>{
			if(imgErr){
				console.error("이미지 조회 에러", imgErr);
				return res.status(500).json({ok :false});
			}
			data.images = images;
			// GoodsDetail하단 관련상품조회 동일카테고리,현재상품제외, 랜덤4개
		const relevanceSql = `
      SELECT 
        dam_goods_posts.*, 
        (SELECT image_url FROM dam_goods_images WHERE goods_id = dam_goods_posts.goods_id LIMIT 1) AS image 
      FROM dam_goods_posts
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

// 이미지 다중 업로드
exports.uploadImages = (req, res) => {
	if (!req.files || req.files.length === 0) {
		console.error("❌ 업로드 실패: 파일이 없습니다.");
		return res.status(400).json({ ok: false, message: "파일이 없습니다." });
	}

	console.log("✅ 업로드 성공 - 파일 개수:", req.files.length);
	console.log("📁 저장된 파일들 :", req.files.map(f => f.filename));

	const files = req.files.map((f) => ({
		savedName: f.filename,
		url: `/uploads/goods/${f.filename}`,
	}));

	console.log("🔗 반환될 URL들:", files);

	res.json({
		ok: true,
		files: files
	});
};