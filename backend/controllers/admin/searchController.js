// backend/controllers/admin/searchController.js
const { db } = require("../../db");

function clampInt(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    return Math.max(min, Math.min(max, i));
}

// Turn "rfid lock pro" into "rfid* AND lock* AND pro*"
function toFtsQuery(q) {
    const raw = String(q ?? "").trim();

    // Allow single-digit searches like "1" (order ids, etc.)
    if (raw.length < 2) {
        if (/^\d+$/.test(raw)) return raw;
        return "";
    }

    const parts = raw.split(/\s+/).filter(Boolean);

    const cooked = parts
        .map((p) => {
            // allow advanced fts queries if user types them
            if (p.includes('"') || p.includes("*") || p.includes(":") || p.includes("NEAR")) return p;

            const clean = p.replace(/"/g, "");
            if (!clean) return "";
            if (/^\d+$/.test(clean)) return clean;

            return `${clean}*`;
        })
        .filter(Boolean);

    return cooked.join(" AND ");
}

const globalSearch = (req, res) => {
    try {
        const q = (req.query.q ?? "").toString();
        const fts = toFtsQuery(q);
        const limit = clampInt(req.query.limit, 5, 50, 20);

        if (!fts) return res.json({ q, groups: [] });

        const rows = db
            .prepare(
                `
                    SELECT
                        entity_type,
                        entity_id,
                        title,
                        snippet(global_fts, 3, '<b>', '</b>', '…', 10) AS snip,
                        bm25(global_fts, 1.0, 0.8, 0.2) AS rank
                    FROM global_fts
                    WHERE global_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                `
            )
            .all(fts, limit);

        // Batch-fetch product_id for variants / stripe_price
        const variantIds = rows.filter((r) => r.entity_type === "variant").map((r) => Number(r.entity_id));
        const stripePriceIds = rows.filter((r) => r.entity_type === "stripe_price").map((r) => Number(r.entity_id));

        const variantToProduct = new Map();
        if (variantIds.length) {
            const placeholders = variantIds.map(() => "?").join(",");
            const vrows = db
                .prepare(`SELECT id, product_id FROM variants WHERE id IN (${placeholders})`)
                .all(...variantIds);
            for (const r of vrows) variantToProduct.set(r.id, r.product_id);
        }

        const stripeToVariantProduct = new Map();
        if (stripePriceIds.length) {
            const placeholders = stripePriceIds.map(() => "?").join(",");
            const srows = db
                .prepare(
                    `
                        SELECT vp.id, vp.variant_id, v.product_id
                        FROM variant_prices vp
                                 JOIN variants v ON v.id = vp.variant_id
                        WHERE vp.id IN (${placeholders})
                    `
                )
                .all(...stripePriceIds);
            for (const r of srows) stripeToVariantProduct.set(r.id, { variant_id: r.variant_id, product_id: r.product_id });
        }

        function hrefFor(type, id) {
            if (type === "product") return `/products/${id}`;
            if (type === "variant") {
                const pid = variantToProduct.get(id);
                return pid ? `/products/${pid}/variant/${id}` : `/products`;
            }
            if (type === "stripe_price") {
                const info = stripeToVariantProduct.get(id);
                return info ? `/products/${info.product_id}/variant/${info.variant_id}` : `/products`;
            }
            if (type === "order") return `/orders/${id}`;
            if (type === "design" || type === "lock_tech") return `/keycards`;
            if (type === "image") return `/media`;
            return `/`;
        }

        const labelFor = (key) => {
            switch (key) {
                case "product":
                    return "Products";
                case "variant":
                    return "Variants";
                case "stripe_price":
                    return "Stripe Price IDs";
                case "order":
                    return "Orders";
                case "design":
                    return "Keycard Designs";
                case "lock_tech":
                    return "Lock Tech";
                case "image":
                    return "Images";
                default:
                    return key;
            }
        };

        const groupsMap = new Map();
        for (const r of rows) {
            const key = r.entity_type;
            if (!groupsMap.has(key)) groupsMap.set(key, { key, label: labelFor(key), items: [] });

            groupsMap.get(key).items.push({
                type: key,
                id: Number(r.entity_id),
                title: r.title,
                subtitle: r.snip?.replace(/<\/?b>/g, "") || "",
                href: hrefFor(key, Number(r.entity_id)),
            });
        }

        res.json({ q, groups: Array.from(groupsMap.values()) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = { globalSearch };
