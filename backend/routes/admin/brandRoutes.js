const express = require("express");
const router = express.Router();

const {
  getAllBrands,
  createBrand,
  updateBrand,
} = require("../../controllers/admin/brandController");

// GET    /api/admin/brands?active=1
// POST   /api/admin/brands
router.route("/").get(getAllBrands).post(createBrand);

// PATCH  /api/admin/brands/:id   (name and/or active)
router.route("/:id").patch(updateBrand);

module.exports = router;
