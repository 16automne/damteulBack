const connection = require("../db");

// ✅ 1. 게시글 작성 (commCreate)
exports.commCreate = (req, res) => {
    const { user_id, title, content, cate, tags } = req.body;
    const files = req.files;
    
    let parsedTags = [];
    try {
        parsedTags = tags ? JSON.parse(tags) : [];
    } catch (e) {
        console.error("❌ 태그 JSON 파싱 실패:", e);
    }

    const sqlPost = "INSERT INTO dam_community_posts (user_id, title, content, cate) VALUES (?, ?, ?, ?)";
    
    connection.query(sqlPost, [user_id || 1, title, content, cate], (err, result) => {
        if (err) {
            console.error("❌ 게시글 저장 SQL 에러:", err.sqlMessage);
            return res.status(500).json({ success: false, message: "게시글 저장 실패" });
        }

        const post_id = result.insertId;

        if (files && files.length > 0) {
            files.forEach((file, index) => {
                const sqlImg = "INSERT INTO dam_community_images (post_id, image_url) VALUES (?, ?)";
                connection.query(sqlImg, [post_id, file.filename], (imgErr, imgResult) => {
                    if (imgErr) return;

                    const image_id = imgResult.insertId;
                    const currentFileTags = parsedTags[index]; 

                    if (Array.isArray(currentFileTags) && currentFileTags.length > 0) {
                        currentFileTags.forEach(tag => {
                            const sqlTag = "INSERT INTO dam_community_tags (image_id, goods_id, x_pos, y_pos) VALUES (?, ?, ?, ?)";
                            const tagParams = [image_id, tag.goods_id || null, tag.x || 0, tag.y || 0];

                            connection.query(sqlTag, tagParams, (tagErr) => {
                                if (tagErr) console.error("❌ 태그 저장 실패:", tagErr.sqlMessage);
                            });
                        });
                    }
                });
            });
        }
        return res.status(201).json({ success: true, post_id });
    });
};

// ✅ 2. 게시글 목록 조회 (commList)
exports.commList = (req, res) => {
    const sql = `
        SELECT 
            p.post_id AS id,
            p.title, 
            p.cate, 
            p.created_at,
            (SELECT image_url FROM dam_community_images WHERE post_id = p.post_id LIMIT 1) AS image_url
        FROM dam_community_posts p
        ORDER BY p.created_at DESC
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error("❌ 목록 조회 실패:", err.sqlMessage);
            return res.status(500).json({ success: false, message: "데이터 로딩 실패" });
        }
        res.json(results);
    });
};

// ✅ 3. 게시글 상세 보기 (commDetail)
exports.commDetail = (req, res) => {
    const { id } = req.params;

    // 1. 게시글 정보 및 작성자 정보 조회
    const sqlPost = `
        SELECT p.*, u.user_nickname, u.level_code, u.profile
        FROM dam_community_posts p
        LEFT JOIN damteul_users u ON p.user_id = u.user_id
        WHERE p.post_id = ?
    `;

    connection.query(sqlPost, [id], (err, postResult) => {
        if (err) {
            console.error("❌ SQL 에러 (Post):", err.sqlMessage);
            return res.status(500).json({ error: "게시글 정보를 불러올 수 없습니다." });
        }
        
        if (postResult.length === 0) return res.status(404).json({ message: "글을 찾을 수 없습니다." });

        // 2. 이미지 정보 조회 (태그 테이블이 없을 때를 대비해 서브쿼리나 JOIN 대신 이미지 테이블만 우선 조회)
        const sqlImages = `
            SELECT image_id, image_url 
            FROM dam_community_images 
            WHERE post_id = ?
        `;

        connection.query(sqlImages, [id], (err, imageRows) => {
            if (err) {
                console.error("❌ SQL 에러 (Images):", err.sqlMessage);
                return res.status(500).json({ error: "이미지 정보를 불러올 수 없습니다." });
            }

            // 3. 태그 데이터 구조 미리 만들기 (현재 테이블이 없으므로 빈 배열 처리)
            // 나중에 태그 기능을 쓸 때 이 부분을 다시 활성화하면 됩니다.
            const imagesWithTags = imageRows.map(img => ({
                ...img,
                tags: [] // 태그 테이블이 없으므로 빈 리스트로 전달하여 프론트 에러 방지
            }));

            res.json({
                post: postResult[0],
                images: imagesWithTags
            });
        });
    });
};