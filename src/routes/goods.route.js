// backend/src/routes/goods.route.js
// router는 “URL → 컨트롤러 함수 연결”만 함 (쿼리 X)

const express = require("express");
const router = express.Router();
const goodsCtrl = require("../controllers/goods.controllers"); // 실제 쿼리를 실행할 파일 불러오기
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // 이미지 열기
// goods.controllers에 연결
router.post("/", upload.array("fileUpload",10), goodsCtrl.create);
// 글 목록 가져오기
router.get("/",goodsCtrl.post);
// 내 중고 상품 목록 가져오기 - 커뮤니티 태그용
// router.get("/myList", goodsCtrl.myList); 
// GoodsDetail에 띄울 상세페이지 정보 조회하기
router.get("/:goods_id", goodsCtrl.findOne);
// 글 삭제하기
router.delete("/:goods_id", goodsCtrl.remove);


module.exports = router;