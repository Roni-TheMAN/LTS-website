// backend/routes/public/productRoutes.js
const express = require("express");
const router = express.Router();

const {
    listPublicProducts,
    getPublicProductById,
    getPublicProductDetail,
} = require("../../controllers/public/productController");

router.get("/", listPublicProducts);
router.get("/:id/detail", getPublicProductDetail);
router.get("/:id", getPublicProductById);

module.exports = router;
