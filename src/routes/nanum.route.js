const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nanumCtrl = require("../controllers/nanum.controllers");

// multer 저장 규칙 설정
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadPath = path.join(__dirname, "../uploads", "nanum");

		// 폴더 없으면 생성
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}

		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		const savedName = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
		cb(null, savedName);
	},
});

// 허용 이미지 확장자/타입
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
const ALLOWED_MIME_PREFIX = ["image/"];

const upload = multer({
	storage: storage,
	fileFilter: (req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		const mimetype = (file.mimetype || "").toLowerCase();

		const mimeOk = ALLOWED_MIME_PREFIX.some((p) => mimetype.startsWith(p));
		const extOk = ALLOWED_EXT.has(ext);

		if (mimeOk && extOk) return cb(null, true);

		const err = new Error("이미지 파일만 업로드 가능합니다. (jpg, png, webp, gif, heic)");
		err.code = "INVALID_FILE_TYPE";
		cb(err);
	},
});

// POST /api/nanum - 나눔 글 작성
router.post("/", nanumCtrl.create);

// 이미지 다중 업로드 (nanum.route.js 자체에서 처리)
router.post("/upload/multi", upload.array("images", 11), nanumCtrl.uploadImages);

// "응모하기" 시 데이터 추가하기
router.post("/apply", nanumCtrl.apply);

// GET /api/nanum/:nanum_id - 나눔 상세페이지 조회
router.get("/:nanum_id", nanumCtrl.findOne);

// 데이터 가져오기
router.get("/", nanumCtrl.findAll);

module.exports = router;