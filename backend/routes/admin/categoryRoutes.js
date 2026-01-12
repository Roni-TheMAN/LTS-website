const express = require("express");
const router = express.Router();

const {
  getAllCategories,
  createCategory,
  updateCategory,
} = require("../../controllers/admin/categoryController");

// GET    /api/admin/categories?active=1
// POST   /api/admin/categories
router.route("/").get(getAllCategories).post(createCategory);

// PATCH  /api/admin/categories/:id
router.route("/:id").patch(updateCategory);

module.exports = router;
