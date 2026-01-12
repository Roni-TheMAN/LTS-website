// routes/productRoutes.js
const express = require("express");
const router = express.Router();

const {
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
} = require("../../controllers/admin/productController");

// /api/products
router.route("/")
    .get(getAllProducts)
    .post(addProduct);

// /api/products/:id
router.route("/:id")
    .get(getProductById)
    .patch(updateProduct);

module.exports = router;
