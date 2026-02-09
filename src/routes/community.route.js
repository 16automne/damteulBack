// backend/src/routes/community.route.js

const express = require("express");
const router = express.Router();
const commController = require("../controllers/community.controllers");
const multer = require("multer");
const path = require("path");

// multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../uploads/community"));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
    }
});
const upload = multer({ storage: storage });

// ✅ 각 함수가 존재하는지 확인하는 로그 (디버깅용)
// console.log("불러온 컨트롤러:", commController);

// 1. 목록 가져오기
router.get("/", commController.commList); 

// 2. 상세 보기
router.get("/:id", commController.commDetail);

// 3. 게시글 작성
router.post("/", upload.array("files", 11), commController.commCreate);

module.exports = router;