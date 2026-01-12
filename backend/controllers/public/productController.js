// backend/controllers/public/productController.js
const { db } = require("../../db");

function parseIdList(value) {
    if (!value) return [];
    return String(value)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
}

// GET /api/public/products
// Optional query params:
//   brands=1,2,3
//   categories=4,5
//   min_price=10.00   (dollars)
//   max_price=999.99  (dollars)
//   q=search text
const listPublicProducts = (req, res) => {
    try {
        const brandIds = parseIdList(req.query.brands);
        const categoryIds = parseIdList(req.query.categories);

        const q = (req.query.q ?? "").toString().trim();
        const minPrice = req.query.min_price !== undefined ? Number(req.query.min_price) : null;
        const maxPrice = req.query.max_price !== undefined ? Number(req.query.max_price) : null;

        const minCents = minPrice === null || Number.isNaN(minPrice) ? null : Math.max(0, Math.round(minPrice * 100));
        const maxCents = maxPrice === null || Number.isNaN(maxPrice) ? null : Math.max(0, Math.round(maxPrice * 100));

        const where = [`p.active = 1`];
        const params = [];

        if (brandIds.length) {
            where.push(`p.brand_id IN (${brandIds.map(() => "?").join(",")})`);
            params.push(...brandIds);
        }
        if (categoryIds.length) {
            where.push(`p.category_id IN (${categoryIds.map(() => "?").join(",")})`);
            params.push(...categoryIds);
        }
        if (q) {
            where.push(`(p.name LIKE ? OR p.description LIKE ?)`);
            params.push(`%${q}%`, `%${q}%`);
        }

        const rows = db
            .prepare(
                `
                    SELECT
                        p.id,
                        p.type,
                        p.name,
                        p.description,
                        p.brand_id,
                        p.category_id,
                        p.created_at,
                        p.updated_at,
                        b.name AS brand_name,
                        c.name AS category_name,
                        (
                            SELECT MAX(vp.unit_amount_cents)
                            FROM variants v
                                     JOIN variant_prices vp ON vp.variant_id = v.id
                            WHERE v.product_id = p.id
                              AND v.active = 1
                              AND vp.active = 1
                        ) AS max_price_cents,
                        (
                            SELECT i.url
                            FROM images i
                            WHERE i.entity_type = 'product'
                              AND i.entity_id = p.id
                            ORDER BY i.sort_order ASC, i.id ASC
                            LIMIT 1
                        ) AS image_url
                    FROM products p
                             LEFT JOIN brands b ON b.id = p.brand_id
                             LEFT JOIN categories c ON c.id = p.category_id
                    WHERE ${where.join(" AND ")}
                    ORDER BY p.id DESC
                `
            )
            // ✅ FIX: spread params
            .all(...params);

        let filtered = rows;
        if (minCents !== null) filtered = filtered.filter((r) => (r.max_price_cents ?? 0) >= minCents);
        if (maxCents !== null) filtered = filtered.filter((r) => (r.max_price_cents ?? 0) <= maxCents);

        res.json({ data: filtered });
    } catch (err) {
        console.error("listPublicProducts error:", err);
        res.status(500).json({ error: "Failed to fetch products." });
    }
};

// GET /api/public/products/:id
const getPublicProductById = (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Invalid product id." });
        }

        const row = db
            .prepare(
                `
                    SELECT
                        p.id,
                        p.type,
                        p.name,
                        p.description,
                        p.brand_id,
                        p.category_id,
                        p.created_at,
                        p.updated_at,
                        b.name AS brand_name,
                        c.name AS category_name,
                        (
                            SELECT MAX(vp.unit_amount_cents)
                            FROM variants v
                                     JOIN variant_prices vp ON vp.variant_id = v.id
                            WHERE v.product_id = p.id
                              AND v.active = 1
                              AND vp.active = 1
                        ) AS max_price_cents,
                        (
                            SELECT i.url
                            FROM images i
                            WHERE i.entity_type = 'product'
                              AND i.entity_id = p.id
                            ORDER BY i.sort_order ASC, i.id ASC
                            LIMIT 1
                        ) AS image_url
                    FROM products p
                             LEFT JOIN brands b ON b.id = p.brand_id
                             LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.id = ? AND p.active = 1
                    LIMIT 1
                `
            )
            .get(id);

        if (!row) return res.status(404).json({ error: "Product not found." });

        res.json({ data: row });
    } catch (err) {
        console.error("getPublicProductById error:", err);
        res.status(500).json({ error: "Failed to fetch product." });
    }
};

// GET /api/public/products/:id/detail
// Returns: product + product images + variants + tier prices
// const getPublicProductDetail = (req, res) => {
//     try {
//         const id = Number(req.params.id);
//         if (!Number.isInteger(id) || id <= 0) {
//             return res.status(400).json({ error: "Invalid product id." });
//         }
//
//         const product = db
//             .prepare(
//                 `
//         SELECT
//           p.id,
//           p.type,
//           p.name,
//           p.description,
//           p.brand_id,
//           p.category_id,
//           p.created_at,
//           p.updated_at,
//           b.name AS brand_name,
//           c.name AS category_name,
//           (
//             SELECT MAX(vp.unit_amount_cents)
//             FROM variants v
//             JOIN variant_prices vp ON vp.variant_id = v.id
//             WHERE v.product_id = p.id
//               AND v.active = 1
//               AND vp.active = 1
//           ) AS max_price_cents,
//           (
//             SELECT i.url
//             FROM images i
//             WHERE i.entity_type = 'product'
//               AND i.entity_id = p.id
//             ORDER BY i.sort_order ASC, i.id ASC
//             LIMIT 1
//           ) AS image_url
//         FROM products p
//         LEFT JOIN brands b ON b.id = p.brand_id
//         LEFT JOIN categories c ON c.id = p.category_id
//         WHERE p.id = ? AND p.active = 1
//         LIMIT 1
//       `
//             )
//             .get(id);
//
//         if (!product) return res.status(404).json({ error: "Product not found." });
//
//         const images = db
//             .prepare(
//                 `
//         SELECT id, url, sort_order
//         FROM images
//         WHERE entity_type = 'product' AND entity_id = ?
//         ORDER BY sort_order ASC, id ASC
//       `
//             )
//             .all(id);
//
//         const variants = db
//             .prepare(
//                 `
//         SELECT
//           v.id,
//           v.product_id,
//           v.sku,
//           v.name,
//           v.description,
//           v.active,
//           (
//             SELECT i.url
//             FROM images i
//             WHERE i.entity_type = 'variant'
//               AND i.entity_id = v.id
//             ORDER BY i.sort_order ASC, i.id ASC
//             LIMIT 1
//           ) AS image_url
//         FROM variants v
//         WHERE v.product_id = ?
//           AND v.active = 1
//         ORDER BY v.id ASC
//       `
//             )
//             .all(id);
//
//         const variantIds = variants.map((v) => v.id);
//         let priceRows = [];
//         if (variantIds.length) {
//             priceRows = db
//                 .prepare(
//                     `
//           SELECT
//             id,
//             variant_id,
//             min_qty,
//             max_qty,
//             currency,
//             unit_amount_cents
//           FROM variant_prices
//           WHERE active = 1
//             AND variant_id IN (${variantIds.map(() => "?").join(",")})
//           ORDER BY variant_id ASC, min_qty ASC
//         `
//                 )
//                 .all(...variantIds);
//         }
//
//         const tiersByVariant = new Map();
//         for (const pr of priceRows) {
//             if (!tiersByVariant.has(pr.variant_id)) tiersByVariant.set(pr.variant_id, []);
//             tiersByVariant.get(pr.variant_id).push(pr);
//         }
//
//         const variantsWithTiers = variants.map((v) => ({
//             ...v,
//             price_tiers: tiersByVariant.get(v.id) ?? [],
//         }));
//
//         res.json({
//             data: {
//                 ...product,
//                 images,
//                 variants: variantsWithTiers,
//             },
//         });
//     } catch (err) {
//         console.error("getPublicProductDetail error:", err);
//         res.status(500).json({ error: "Failed to fetch product detail." });
//     }
// };


const getPublicProductDetail = (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Invalid product id." });
        }

        const product = db
            .prepare(
                `
                    SELECT
                        p.id,
                        p.type,
                        p.name,
                        p.description,
                        p.brand_id,
                        p.category_id,
                        p.stripe_product_id,
                        p.created_at,
                        p.updated_at,
                        b.name AS brand_name,
                        c.name AS category_name,
                        (
                            SELECT MAX(vp.unit_amount_cents)
                            FROM variants v
                                     JOIN variant_prices vp ON vp.variant_id = v.id
                            WHERE v.product_id = p.id
                              AND v.active = 1
                              AND vp.active = 1
                        ) AS max_price_cents,
                        (
                            SELECT i.url
                            FROM images i
                            WHERE i.entity_type = 'product'
                              AND i.entity_id = p.id
                            ORDER BY i.sort_order ASC, i.id ASC
                            LIMIT 1
                        ) AS image_url
                    FROM products p
                             LEFT JOIN brands b ON b.id = p.brand_id
                             LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.id = ? AND p.active = 1
                    LIMIT 1
                `
            )
            .get(id);

        if (!product) {
            return res.status(404).json({ error: "Product not found." });
        }

        const images = db
            .prepare(
                `
                    SELECT id, url, sort_order
                    FROM images
                    WHERE entity_type = 'product'
                      AND entity_id = ?
                    ORDER BY sort_order ASC, id ASC
                `
            )
            .all(id);

        const variants = db
            .prepare(
                `
                    SELECT
                        v.id,
                        v.product_id,
                        v.sku,
                        v.name,
                        v.description,
                        v.active,
                        (
                            SELECT i.url
                            FROM images i
                            WHERE i.entity_type = 'variant'
                              AND i.entity_id = v.id
                            ORDER BY i.sort_order ASC, i.id ASC
                            LIMIT 1
                        ) AS image_url
                    FROM variants v
                    WHERE v.product_id = ?
                      AND v.active = 1
                    ORDER BY v.id ASC
                `
            )
            .all(id);

        const variantIds = variants.map(v => v.id);

        let priceRows = [];
        if (variantIds.length) {
            priceRows = db
                .prepare(
                    `
                        SELECT
                            id,
                            variant_id,
                            min_qty,
                            max_qty,
                            currency,
                            unit_amount_cents,
                            stripe_price_id
                        FROM variant_prices
                        WHERE active = 1
                          AND stripe_price_id IS NOT NULL
                          AND variant_id IN (${variantIds.map(() => "?").join(",")})
                        ORDER BY variant_id ASC, min_qty ASC
                    `
                )
                .all(...variantIds);
        }

        const tiersByVariant = new Map();
        for (const row of priceRows) {
            if (!tiersByVariant.has(row.variant_id)) {
                tiersByVariant.set(row.variant_id, []);
            }
            tiersByVariant.get(row.variant_id).push(row);
        }

        const variantsWithTiers = variants.map(v => ({
            ...v,
            price_tiers: tiersByVariant.get(v.id) ?? [],
        }));

        res.json({
            data: {
                ...product,
                images,
                variants: variantsWithTiers,
            },
        });
    } catch (err) {
        console.error("getPublicProductDetail error:", err);
        res.status(500).json({ error: "Failed to fetch product detail." });
    }
};

module.exports = {
    listPublicProducts,
    getPublicProductById,
    getPublicProductDetail,
};
