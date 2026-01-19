// backend/src/app.js
// Express설정 + 라우터 연결

const express = require("express");
const cors = require("cors");

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

// ✅ 404 + 에러 핸들링(맨 아래 있어야함)
app.use(notFound);  // 그런 주소 없어
app.use(errorHandler); //문제가 생겼지만 서버는 괜찮아!

// app 내보내기
module.exports = app;