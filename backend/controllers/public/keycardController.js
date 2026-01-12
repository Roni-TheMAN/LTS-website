// backend/controllers/public/keycardController.js
const { db } = require("../../db");

const CARDS_PER_BOX = 200;

function isPosInt(n) {
    return Number.isInteger(n) && n > 0;
}

function toInt(x) {
    const n = Number(x);
    return Number.isFinite(n) ? Math.floor(n) : NaN;
}

function normalizeTiers(rows) {
    // Sort by min_boxes and derive max_boxes from next min (prevents gaps/overlaps)
    const sorted = (rows || [])
        .map((r) => ({
            id: r.id,
            lock_tech_id: r.lock_tech_id,
            min_boxes: Number(r.min_boxes),
            currency: (r.currency || "usd").toString(),
            price_per_box_cents: Number(r.price_per_box_cents),
            created_at: r.created_at,
        }))
        .filter((t) => Number.isInteger(t.min_boxes) && t.min_boxes >= 1)
        .sort((a, b) => a.min_boxes - b.min_boxes || a.id - b.id);

    return sorted.map((t, idx) => {
        const next = sorted[idx + 1];
        const derivedMax = next ? next.min_boxes - 1 : null;
        return {
            ...t,
            max_boxes: derivedMax === null ? null : Math.max(t.min_boxes, derivedMax),
        };
    });
}

function pickTier(tiers, boxes) {
    const b = Math.max(1, boxes);
    const hit = tiers.find((t) => b >= t.min_boxes && (t.max_boxes === null || b <= t.max_boxes));
    if (hit) return hit;

    // fallback: last tier with min <= boxes
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (b >= tiers[i].min_boxes) return tiers[i];
    }
    return null;
}

// GET /api/public/keycards/brands
const listKeycardBrands = (req, res) => {
    try {
        const rows = db
            .prepare(
                `
                    SELECT
                        b.id,
                        b.name,
                        COUNT(d.id) AS designs_count
                    FROM keycard_brands b
                             LEFT JOIN keycard_designs d
                                       ON d.brand_id = b.id
                                           AND d.active = 1
                    WHERE b.active = 1
                    GROUP BY b.id, b.name
                    ORDER BY b.name COLLATE NOCASE
                `
            )
            .all();

        return res.json({ data: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load keycard brands." });
    }
};

// GET /api/public/keycards/designs?brand_id=1&q=wave
const listKeycardDesigns = (req, res) => {
    try {
        const brandIdRaw = req.query.brand_id;
        const qRaw = (req.query.q ?? "").toString().trim().toLowerCase();

        const where = ["d.active = 1"];
        const params = [];

        const brandId = brandIdRaw === undefined || brandIdRaw === null || brandIdRaw === "" ? null : toInt(brandIdRaw);
        if (brandId !== null) {
            if (!isPosInt(brandId)) return res.status(400).json({ error: "Invalid brand_id." });
            where.push("d.brand_id = ?");
            params.push(brandId);
        }

        if (qRaw) {
            const like = `%${qRaw}%`;
            where.push(
                `(LOWER(d.name) LIKE ? OR LOWER(COALESCE(d.description,'')) LIKE ? OR LOWER(d.code) LIKE ? OR LOWER(COALESCE(b.name,'')) LIKE ?)`
            );
            params.push(like, like, like, like);
        }

        const sql = `
      SELECT
        d.id,
        d.brand_id,
        b.name AS brand_name,
        d.code,
        d.name,
        d.description,
        d.created_at,
        (
          SELECT i.url
          FROM images i
          WHERE i.entity_type = 'design' AND i.entity_id = d.id
          ORDER BY i.sort_order ASC, i.id ASC
          LIMIT 1
        ) AS image_front_url,
        (
          SELECT i.url
          FROM images i
          WHERE i.entity_type = 'design' AND i.entity_id = d.id
          ORDER BY i.sort_order ASC, i.id ASC
          LIMIT 1 OFFSET 1
        ) AS image_back_url
      FROM keycard_designs d
      LEFT JOIN keycard_brands b ON b.id = d.brand_id
      WHERE ${where.join(" AND ")}
      ORDER BY d.created_at DESC, d.id DESC
    `;

        const rows = db.prepare(sql).all(...params);
        return res.json({ data: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load keycard designs." });
    }
};

// GET /api/public/keycards/designs/:id
const getKeycardDesignById = (req, res) => {
    try {
        const id = toInt(req.params.id);
        if (!isPosInt(id)) return res.status(400).json({ error: "Invalid design id." });

        const row = db
            .prepare(
                `
        SELECT
          d.id,
          d.brand_id,
          b.name AS brand_name,
          d.code,
          d.name,
          d.description,
          d.active,
          d.created_at
        FROM keycard_designs d
        LEFT JOIN keycard_brands b ON b.id = d.brand_id
        WHERE d.id = ? AND d.active = 1
      `
            )
            .get(id);

        if (!row) return res.status(404).json({ error: "Design not found." });

        const images = db
            .prepare(
                `
        SELECT id, url, alt_text, sort_order, created_at
        FROM images
        WHERE entity_type='design' AND entity_id=?
        ORDER BY sort_order ASC, id ASC
      `
            )
            .all(id);

        return res.json({ data: { ...row, images } });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load design." });
    }
};

// GET /api/public/keycards/lock-tech
const listLockTech = (req, res) => {
    try {
        const rows = db
            .prepare(
                `
        SELECT id, name, created_at
        FROM lock_tech
        WHERE active = 1
        ORDER BY name COLLATE NOCASE
      `
            )
            .all();

        return res.json({ data: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load lock tech." });
    }
};

// GET /api/public/keycards/lock-tech/:id/tiers
const listLockTechTiers = (req, res) => {
    try {
        const lockTechId = toInt(req.params.id);
        if (!isPosInt(lockTechId)) return res.status(400).json({ error: "Invalid lock tech id." });

        const raw = db
            .prepare(
                `
        SELECT id, lock_tech_id, min_boxes, max_boxes, currency, price_per_box_cents, created_at
        FROM keycard_price_tiers
        WHERE lock_tech_id = ? AND active = 1
        ORDER BY min_boxes ASC, id ASC
      `
            )
            .all(lockTechId);

        const tiers = normalizeTiers(raw);
        return res.json({ data: tiers });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load pricing tiers." });
    }
};

// GET /api/public/keycards/quote?design_id=10&lock_tech_id=2&boxes=5
const quoteKeycards = (req, res) => {
    try {
        const designId = req.query.design_id === undefined ? null : toInt(req.query.design_id);
        const lockTechId = toInt(req.query.lock_tech_id);
        const boxes = toInt(req.query.boxes);

        if (!isPosInt(lockTechId)) return res.status(400).json({ error: "Invalid lock_tech_id." });
        if (!Number.isFinite(boxes) || boxes < 1) return res.status(400).json({ error: "Invalid boxes (>= 1)." });

        // optional design check (only if provided)
        let design = null;
        if (designId !== null) {
            if (!isPosInt(designId)) return res.status(400).json({ error: "Invalid design_id." });
            design = db
                .prepare(
                    `
          SELECT d.id, d.code, d.name, d.description, d.brand_id, b.name AS brand_name
          FROM keycard_designs d
          LEFT JOIN keycard_brands b ON b.id = d.brand_id
          WHERE d.id = ? AND d.active = 1
        `
                )
                .get(designId);
            if (!design) return res.status(404).json({ error: "Design not found." });
        }

        const raw = db
            .prepare(
                `
        SELECT id, lock_tech_id, min_boxes, max_boxes, currency, price_per_box_cents, created_at
        FROM keycard_price_tiers
        WHERE lock_tech_id = ? AND active = 1
        ORDER BY min_boxes ASC, id ASC
      `
            )
            .all(lockTechId);

        const tiers = normalizeTiers(raw);
        if (tiers.length === 0) return res.status(404).json({ error: "No active tiers for this lock tech." });

        const tier = pickTier(tiers, boxes);
        if (!tier) return res.status(404).json({ error: "No matching tier found." });

        const unit = tier.price_per_box_cents;
        const subtotal = unit * boxes;

        return res.json({
            data: {
                design,
                lock_tech_id: lockTechId,
                boxes,
                cards_per_box: CARDS_PER_BOX,
                total_cards: boxes * CARDS_PER_BOX,
                currency: tier.currency,
                price_per_box_cents: unit,
                subtotal_cents: subtotal,
                tier: { min_boxes: tier.min_boxes, max_boxes: tier.max_boxes },
            },
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to generate quote." });
    }
};

module.exports = {
    listKeycardBrands,
    listKeycardDesigns,
    getKeycardDesignById,
    listLockTech,
    listLockTechTiers,
    quoteKeycards,
};
