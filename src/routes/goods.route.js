// backend/src/routes/goods.route.js
const express = require("express");
const router = express.Router();
const goodsCtrl = require("../controllers/goods.controllers");

// 글 작성
router.post("/", goodsCtrl.create);

// 글 목록 가져오기
router.get("/", goodsCtrl.post);

// GoodsDetail에 띄울 상세페이지 정보 조회하기
router.get("/:goods_id", goodsCtrl.findOne);

// 글 삭제하기
router.delete("/:goods_id", goodsCtrl.remove);

// 좋아요 토글
router.post('/like', goodsCtrl.toggleLike);

module.exports = router;