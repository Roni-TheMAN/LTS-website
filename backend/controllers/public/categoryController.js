// backend/controllers/public/categoryController.js
const { db } = require("../../db");

// GET /api/public/categories
const listPublicCategories = (req, res) => {
    try {
        const rows = db
            .prepare(
                `
                    SELECT
                        c.id,
                        c.parent_id,
                        c.name,
                        c.active,
                        c.created_at,
                        (
                            SELECT COUNT(*)
                            FROM products p
                            WHERE p.category_id = c.id AND p.active = 1
                        ) AS products_count
                    FROM categories c
                    WHERE c.active = 1
                    ORDER BY c.name COLLATE NOCASE ASC
                `
            )
            .all();

        res.json({ data: rows });
    } catch (err) {
        console.error("listPublicCategories error:", err);
        res.status(500).json({ error: "Failed to fetch categories." });
    }
};

module.exports = { listPublicCategories };
