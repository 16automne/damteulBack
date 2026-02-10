const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

// routes 및 미들웨어 불러오기
const apiRoutes = require("./routes");
const notFound = require("./middlewares/notFound.middleware");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

// ✅ 1. 공통 미들웨어 세팅
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 사진 통로 설정 (라우터 연결보다 위에 있는 것이 좋습니다)
// 브라우저에서 http://localhost:9070/uploads/community/파일명 으로 접근 가능하게 함
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ✅ 상태 체크용
app.get("/", (req, res) => {
  res.json({ message: "Damteul backend is running!" });
});

// ✅ API 라우팅 진입점 (프론트에서 서버 불러올시 무조건 api부터)
app.use("/api", apiRoutes);

// ✅ 404 + 에러 핸들링(맨 아래 있어야함)
app.use(notFound);  // 그런 주소 없어
app.use(errorHandler); //문제가 생겼지만 서버는 괜찮아!

// app 내보내기
module.exports = app;