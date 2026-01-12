// backend/routes/keycardRoutes.js
const express = require("express");
const router = express.Router();

const {
    // brands
    listBrands,
    createBrand,
    updateBrand,
    deleteBrand,

    // lock tech
    listLockTech,
    createLockTech,
    updateLockTech,
    deleteLockTech,

    // tiers
    listTiersForLockTech,
    replaceTiersForLockTech,

    // designs
    listDesigns,
    createDesign,
    updateDesign,
    deleteDesign,
    addDesignImage,
} = require("../../controllers/admin/keycardController");

// brands
router.get("/brands", listBrands);
router.post("/brands", createBrand);
router.patch("/brands/:id", updateBrand);
router.delete("/brands/:id", deleteBrand);

// lock technologies
router.get("/lock-tech", listLockTech);
router.post("/lock-tech", createLockTech);
router.patch("/lock-tech/:id", updateLockTech);
router.delete("/lock-tech/:id", deleteLockTech);

// tiers (per lock-tech)
router.get("/lock-tech/:id/tiers", listTiersForLockTech);
router.put("/lock-tech/:id/tiers", replaceTiersForLockTech);

// designs
router.get("/designs", listDesigns);
router.post("/designs", createDesign);
router.patch("/designs/:id", updateDesign);
router.delete("/designs/:id", deleteDesign);
router.post("/designs/:id/image", addDesignImage);

module.exports = router;
