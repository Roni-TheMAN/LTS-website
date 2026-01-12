// routes/public/publicOrdersRoutes.js
"use strict";

const express = require("express");
const router = express.Router();

const controller = require("../../controllers/public/publicOrdersController");

// Public: create + fetch (NO UPDATE/DELETE, NO LIST)
router.get("/lookup", controller.lookupOrder);
router.post("/lookup", controller.lookupOrder);

router.get("/by-session/:sessionId", controller.getBySession);

module.exports = router;
