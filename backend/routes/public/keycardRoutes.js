// backend/routes/public/keycardRoutes.js
const express = require("express");
const router = express.Router();

const {
    listKeycardBrands,
    listKeycardDesigns,
    getKeycardDesignById,
    listLockTech,
    listLockTechTiers,
    quoteKeycards,
} = require("../../controllers/public/keycardController");

// Filters are only: brand + search
router.get("/brands", listKeycardBrands);
router.get("/designs", listKeycardDesigns);
router.get("/designs/:id", getKeycardDesignById);

// Lock-tech + tiered pricing per lock-tech
router.get("/lock-tech", listLockTech);
router.get("/lock-tech/:id/tiers", listLockTechTiers);

// Convenience endpoint to compute pricing server-side
router.get("/quote", quoteKeycards);

module.exports = router;
