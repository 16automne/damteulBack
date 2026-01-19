// backend/src/routes/goods.route.js
// router는 “URL → 컨트롤러 함수 연결”만 함 (쿼리 X)

const express = require("express");
const router = express.Router();
// const goods = require("../controllers/goods.controller");

// 예시
// router.get("/", goods.list);            // GET /api/goods
// router.post("/", goods.create);         // POST /api/goods
// router.get("/:goodsId", goods.detail);  // GET /api/goods/:goodsId
// router.put("/:goodsId", goods.update);  // PUT /api/goods/:goodsId
// router.delete("/:goodsId", goods.remove); // DELETE /api/goods/:goodsId


module.exports = router;