/**
 * backend/routes/admin/adminOrdersRoutes.js
 */

const express = require("express");
const router = express.Router();

const {
    listOrders,
    getOrder,
    createOrder,              // NEW
    updateOrder,
    deleteOrder,
} = require("../../controllers/admin/adminOrdersController");

// TODO: protect these routes (cookie-based admin sessions)
// const requireAdmin = require("../../middleware/requireAdmin");
// router.use(requireAdmin);

router.get("/", listOrders);
router.post("/", createOrder); // NEW

router.get("/:id", getOrder);
router.put("/:id", updateOrder);
router.delete("/:id", deleteOrder);

module.exports = router;
