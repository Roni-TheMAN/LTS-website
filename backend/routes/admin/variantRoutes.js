//routes/variantRoutes.js
const express = require("express");
const router = express.Router();

const {
    createVariant,
    getVariantsByProductId,
    getVariantById,
    updateVariant,

    // tiered pricing
    getVariantPrices,
    replaceVariantPrices,
    getUnitPriceForQty,
} = require("../../controllers/admin/variantController");

// IMPORTANT: route order matters.
// Put the more specific routes BEFORE "/:variantId",
// otherwise "prices" or "price" will be treated as :variantId.

// GET  /api/variants/product/:productId?active=0|1|2|all  -> list variants for a product
// POST /api/variants/product/:productId                   -> create variant under a product
router.route("/product/:productId")
    .get(getVariantsByProductId)
    .post(createVariant);

// ---- Tiered pricing routes (must be before "/:variantId") ----

// GET /api/variants/:variantId/prices?active=1|all
// PUT /api/variants/:variantId/prices  (replace all tiers; server normalizes)
router.route("/:variantId/prices")
    .get(getVariantPrices)
    .put(replaceVariantPrices);

// GET /api/variants/:variantId/price?qty=37  (price lookup for a given qty)
router.route("/:variantId/price")
    .get(getUnitPriceForQty);

// ---- Variant routes ----

// GET   /api/variants/:variantId
// PATCH /api/variants/:variantId
router.route("/:variantId")
    .get(getVariantById)
    .patch(updateVariant);

module.exports = router;
