// backend/routes/public/categoryRoutes.js
const express = require("express");
const router = express.Router();
const { listPublicCategories } = require("../../controllers/public/categoryController");

router.get("/", listPublicCategories);

module.exports = router;
