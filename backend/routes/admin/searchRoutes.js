// backend/routes/admin/searchRoutes.js
const express = require("express");
const router = express.Router();
const { globalSearch } = require("../../controllers/admin/searchController");

router.get("/", globalSearch);

module.exports = router;
