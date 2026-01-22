const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controllers");


// 회원가입
// /api/user/register
router.post("/register", userController.register);

module.exports = router;