// backend/src/app.js
// Express설정 + 라우터 연결

const express = require("express");
const cors = require("cors");

// 브라우저에서 온 파일을 서버 디스크에 저장 해주는 통역사
const multer = require("multer");

// 경로 메서드
const path = require("path");
// 파일 생성 메서드
const fs = require("fs");

// routes가 모여있는 index파일
const apiRoutes = require("./routes");

// 예상치 못한 에러 발생시
const notFound = require("./middlewares/notFound.middleware");
const errorHandler = require("./middlewares/error.middleware");

// 서버 생성 - express()
const app = express();

// ✅ 공통 미들웨어 (서버 기본 세팅)
app.use(cors());  // 3000포트와 9070포트를 연결시키기 위함
app.use(express.json());  // 프론트 내용(req)을 번역시키기 위함
app.use(express.urlencoded({ extended: true }));

// ✅ 상태 체크용
app.get("/", (req, res) => {
  res.json({ message: "Damteul backend is running!" });
});

// ✅ API 라우팅 진입점 (프론트에서 서버 불러올시 무조건 api부터)
app.use("/api", apiRoutes);






// 허용 이미지 확장자/타입 (모바일 호환 고려)
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
const ALLOWED_MIME_PREFIX = ["image/"]; // image/png, image/jpeg 등

// “URL이 /uploads/...로 오면, 서버의 damteulBackend/uploads/... 폴더에서 파일을 찾아서 그대로 보내줘!”
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// multer 저장 규칙
// 1. cb(결과값)에 error가 없을때 damteulBackend/uploads/... 에 브라우저에서 보낸 URL을 파일 경로로 바꿔서 저장해줘
// 2. 파일 이름은 겹치지 않게 저장한다. cb(결과값)에 error가 없을때 저장된 값을 보낸다.

const storage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "uploads", folder);

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



// const multer = require("multer");
const upload=(folder) => multer({
  storage:storage(folder),

  //파일 필터 (mimetype + 확장자 둘 다 체크)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimetype = (file.mimetype || "").toLowerCase();

    const mimeOk = ALLOWED_MIME_PREFIX.some((p) => mimetype.startsWith(p));
    const extOk = ALLOWED_EXT.has(ext);

    // 모바일에서 간혹 mimetype이 비정상/빈 값인 경우가 있어 확장자도 함께 허용
    if (mimeOk && extOk) return cb(null, true);

    // 거절: 에러를 next로 넘겨서 에러핸들러에서 처리하게 함
    const err = new Error("이미지 파일만 업로드 가능합니다. (jpg, png, webp, gif, heic)");
    err.code = "INVALID_FILE_TYPE";
    cb(err);
  },
});


// 들어올수 있는 url 한정 시키기
const ALLOWED = ["community", "goods", "profile"];


// url 한정 함수
const validateUploadPath = (req, res, next) => {
  if (!ALLOWED.includes(req.params.url)) {
    return res.status(400).json({
      success: false,
      message: "허용되지 않은 경로",
    });
  }
  next();
};


// 1) 이미지 업로드 API (단일)
app.post(
  "/api/upload/single/:url",
    validateUploadPath,
  (req, res, next) => upload(req.params.url).single("image")(req, res, next),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "파일이 없습니다." });
    }

    const savedName = req.file.filename;
    res.json({
      success: true,
      savedName,
      url: `/uploads/${req.params.url}/${savedName}`,
    });
  }
);



// ✅ 1) 이미지 업로드 API
/** ✅ 다중 */
app.post(
  "/api/upload/multi/:url",
  validateUploadPath,
  (req, res, next) => upload(req.params.url).array("images", 11)(req, res, next),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "파일이 없습니다." });
    }

    const files = req.files.map((f) => ({
      savedName: f.filename,
      url: `/uploads/${req.params.url}/${f.filename}`,
    }));

    res.json({
      success: true,
      files,
    });
  }
);


// ✅ 404 + 에러 핸들링(맨 아래 있어야함)
app.use(notFound);  // 그런 주소 없어
app.use(errorHandler); //문제가 생겼지만 서버는 괜찮아!

// app 내보내기
module.exports = app;
// module.exports = storage;