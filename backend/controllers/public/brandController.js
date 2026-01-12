// backend/controllers/public/brandController.js
const { db } = require("../../db");

// GET /api/public/brands
const listPublicBrands = (req, res) => {
    try {
        const rows = db
            .prepare(
                `
                    SELECT
                        b.id,
                        b.name,
                        b.active,
                        b.created_at,
                        (
                            SELECT COUNT(*)
                            FROM products p
                            WHERE p.brand_id = b.id AND p.active = 1
                        ) AS products_count
                    FROM brands b
                    WHERE b.active = 1
                    ORDER BY b.name COLLATE NOCASE ASC
                `
            )
            .all();

        res.json({ data: rows });
    } catch (err) {
        console.error("listPublicBrands error:", err);
        res.status(500).json({ error: "Failed to fetch brands." });
    }
};

module.exports = { listPublicBrands };
