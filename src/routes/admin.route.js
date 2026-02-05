const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controllers");



// 주소 가져오기
// ✅ GET /api/addresses?q=역삼&limit=10
// q: 검색어
// limit: 최대 몇개까지 줄지 (기본 10)
router.post("/auth/login", adminController.adminLogin);


router.get("/dashboard", adminController.dashboard);

// adminUsers
router.get("/users", adminController.users);
router.get("/users/:user_id", adminController.getUserDetail);
router.delete("/users/:id", adminController.userDelete);

// adminReports
router.get("/reports", adminController.reports);
router.get("/reports/:id", adminController.getReportsDetail);
router.patch("/reports/:id", adminController.updateReportsDetail);
router.delete("/reports/:id", adminController.reportDelete);

// adminTrades
router.get("/trades", adminController.trades);
router.get("/trades/:id", adminController.getTradesDeatail);
router.delete("/trades/:id", adminController.tradeDelete);

// admainCommu
router.get("/community", adminController.community);

// adminPosts (젤 하단에 위치 시킬것)
router.get("/posts", adminController.posts);
router.delete("/:url/:id", adminController.postDelete);
router.get("/:cate/:id", adminController.getPostDetail);

module.exports = router;