// backend/routes/public/brandRoutes.js
const express = require("express");
const router = express.Router();
const { listPublicBrands } = require("../../controllers/public/brandController");

router.get("/", listPublicBrands);

module.exports = router;
