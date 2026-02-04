const express = require("express");
const router = express.Router();
const commController = require("../controllers/community.controllers");

router.put("/", commController.commCreate);

module.exports = router;