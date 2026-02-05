const express = require("express");
const router = express.Router();
const nanumCtrl = require("../controllers/nanum.controllers"); // 나눔 컨트롤러
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// POST /api/nanum - 나눔 글 작성
router.post("/", upload.array("fileUpload", 10), nanumCtrl.create);

// GET /api/nanum/:nanum_id - 나눔 상세페이지 조회
router.get("/:nanum_id", nanumCtrl.findOne);

// 데이터 가져오기
router.get("/", nanumCtrl.findAll);
// "응모하기" 시 데이터 추가하기
router.post("/apply", nanumCtrl.apply);

module.exports = router;