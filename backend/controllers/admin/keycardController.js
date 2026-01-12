// backend/controllers/keycardController.js
const { db } = require("../../db");

// ------------------------
// helpers
// ------------------------
function asInt(v) {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
}
function asTrimmedString(v) {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s.length ? s : null;
}
function asActive01(v) {
    if (v === true) return 1;
    if (v === false) return 0;
    const n = Number(v);
    if (n === 0 || n === 1) return n;
    return null;
}
function sqliteIsUniqueConstraint(e) {
    return String(e?.code || "").includes("SQLITE_CONSTRAINT") || /UNIQUE/i.test(String(e?.message || ""));
}

// ------------------------
// BREAKPOINT TIERS NORMALIZATION (boxes)
// - client sends min_boxes + price_per_box_cents (+ currency optional)
// - we IGNORE max_boxes from client, compute from next min
// - force first min=1, strictly increasing mins
// ------------------------
function normalizeBoxTiers(input) {
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error("tiers must be a non-empty array.");
    }

    const cleaned = input.map((t, idx) => {
        const min_boxes = asInt(t?.min_boxes);
        const price_per_box_cents = asInt(t?.price_per_box_cents);
        const currency = asTrimmedString(t?.currency) || "usd";

        if (!min_boxes || min_boxes < 1) {
            throw new Error(`tiers[${idx}].min_boxes must be an integer >= 1.`);
        }
        if (price_per_box_cents === null || price_per_box_cents < 0) {
            throw new Error(`tiers[${idx}].price_per_box_cents must be an integer >= 0.`);
        }
        return { min_boxes, price_per_box_cents, currency };
    });

    cleaned.sort((a, b) => a.min_boxes - b.min_boxes);

    // enforce first min=1
    cleaned[0].min_boxes = 1;

    // enforce strictly increasing mins
    for (let i = 1; i < cleaned.length; i++) {
        if (cleaned[i].min_boxes <= cleaned[i - 1].min_boxes) {
            cleaned[i].min_boxes = cleaned[i - 1].min_boxes + 1;
        }
    }

    // compute derived max
    const normalized = cleaned.map((t, i) => {
        const next = cleaned[i + 1];
        const max_boxes = next ? next.min_boxes - 1 : null; // last = "and up"
        return { ...t, max_boxes };
    });

    return normalized;
}

// ------------------------
// BRANDS
// ------------------------
const listBrands = (req, res) => {
    try {
        const activeParam = req.query.active;
        const active = activeParam === undefined ? null : asActive01(activeParam);
        if (activeParam !== undefined && active === null) {
            return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
        }

        const rows = db
            .prepare(
                `
        SELECT *
        FROM keycard_brands
        WHERE (? IS NULL OR active = ?)
        ORDER BY created_at DESC, id DESC
      `
            )
            .all(active, active);

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const createBrand = (req, res) => {
    try {
        const name = asTrimmedString(req.body?.name);
        if (!name) return res.status(400).json({ error: "name is required." });

        const info = db.prepare(`INSERT INTO keycard_brands (name, active) VALUES (?, 1)`).run(name);
        const row = db.prepare(`SELECT * FROM keycard_brands WHERE id = ?`).get(info.lastInsertRowid);
        res.status(201).json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Brand name already exists." });
        res.status(500).json({ error: e.message });
    }
};

const updateBrand = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const name = req.body?.name === undefined ? undefined : asTrimmedString(req.body?.name);
        const active = req.body?.active === undefined ? undefined : asActive01(req.body?.active);

        if (req.body?.name !== undefined && !name) return res.status(400).json({ error: "name cannot be empty." });
        if (req.body?.active !== undefined && active === null) return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });

        const sets = [];
        const params = [];

        if (name !== undefined) { sets.push("name = ?"); params.push(name); }
        if (active !== undefined) { sets.push("active = ?"); params.push(active); }

        if (!sets.length) return res.status(400).json({ error: "No valid fields to update." });

        params.push(id);
        const info = db.prepare(`UPDATE keycard_brands SET ${sets.join(", ")} WHERE id = ?`).run(...params);
        if (info.changes === 0) return res.status(404).json({ error: "Brand not found." });

        const row = db.prepare(`SELECT * FROM keycard_brands WHERE id = ?`).get(id);
        res.json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Brand name already exists." });
        res.status(500).json({ error: e.message });
    }
};

const deleteBrand = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const tx = db.transaction(() => {
            db.prepare(`UPDATE keycard_designs SET brand_id = NULL WHERE brand_id = ?`).run(id);
            return db.prepare(`DELETE FROM keycard_brands WHERE id = ?`).run(id);
        });

        const info = tx();
        if (info.changes === 0) return res.status(404).json({ error: "Brand not found." });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ------------------------
// LOCK TECH
// ------------------------
const listLockTech = (req, res) => {
    try {
        const activeParam = req.query.active;
        const active = activeParam === undefined ? null : asActive01(activeParam);
        if (activeParam !== undefined && active === null) {
            return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
        }

        const rows = db
            .prepare(
                `
        SELECT
          lt.*,
          (
            SELECT COUNT(*)
            FROM keycard_price_tiers kt
            WHERE kt.lock_tech_id = lt.id AND kt.active = 1
          ) AS tiers_count
        FROM lock_tech lt
        WHERE (? IS NULL OR lt.active = ?)
        ORDER BY lt.created_at DESC, lt.id DESC
      `
            )
            .all(active, active);

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const createLockTech = (req, res) => {
    try {
        const name = asTrimmedString(req.body?.name);
        if (!name) return res.status(400).json({ error: "name is required." });

        const info = db.prepare(`INSERT INTO lock_tech (name, active) VALUES (?, 1)`).run(name);
        const row = db.prepare(`SELECT * FROM lock_tech WHERE id = ?`).get(info.lastInsertRowid);
        res.status(201).json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Technology name already exists." });
        res.status(500).json({ error: e.message });
    }
};

const updateLockTech = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const name = req.body?.name === undefined ? undefined : asTrimmedString(req.body?.name);
        const active = req.body?.active === undefined ? undefined : asActive01(req.body?.active);

        if (req.body?.name !== undefined && !name) return res.status(400).json({ error: "name cannot be empty." });
        if (req.body?.active !== undefined && active === null) return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });

        const sets = [];
        const params = [];
        if (name !== undefined) { sets.push("name = ?"); params.push(name); }
        if (active !== undefined) { sets.push("active = ?"); params.push(active); }

        if (!sets.length) return res.status(400).json({ error: "No valid fields to update." });

        params.push(id);
        const info = db.prepare(`UPDATE lock_tech SET ${sets.join(", ")} WHERE id = ?`).run(...params);
        if (info.changes === 0) return res.status(404).json({ error: "Technology not found." });

        const row = db.prepare(`SELECT * FROM lock_tech WHERE id = ?`).get(id);
        res.json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Technology name already exists." });
        res.status(500).json({ error: e.message });
    }
};

const deleteLockTech = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const tx = db.transaction(() => {
            db.prepare(`DELETE FROM keycard_price_tiers WHERE lock_tech_id = ?`).run(id);
            return db.prepare(`DELETE FROM lock_tech WHERE id = ?`).run(id);
        });

        const info = tx();
        if (info.changes === 0) return res.status(404).json({ error: "Technology not found." });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ------------------------
// TIERS (per lock tech)
// ------------------------
const listTiersForLockTech = (req, res) => {
    try {
        const lockTechId = asInt(req.params.id);
        if (!lockTechId || lockTechId <= 0) {
            return res.status(400).json({ error: "Invalid lock tech id." });
        }

        const activeParam = req.query.active;
        const active = activeParam === undefined ? 1 : asActive01(activeParam);
        if (activeParam !== undefined && active === null) {
            return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
        }

        const rows = db
            .prepare(
                `
        SELECT
          id,
          lock_tech_id,
          min_boxes,
          max_boxes,
          currency,
          price_per_box_cents,
          active,
          created_at
        FROM keycard_price_tiers
        WHERE lock_tech_id = ?
          AND active = ?
        ORDER BY min_boxes ASC, id ASC
      `
            )
            .all(lockTechId, active);

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const replaceTiersForLockTech = (req, res) => {
    try {
        const lockTechId = asInt(req.params.id);
        if (!lockTechId || lockTechId <= 0) {
            return res.status(400).json({ error: "Invalid lock tech id." });
        }

        // check lock tech exists
        const exists = db.prepare(`SELECT id FROM lock_tech WHERE id = ?`).get(lockTechId);
        if (!exists) return res.status(404).json({ error: "Lock tech not found." });

        const inputTiers = req.body?.tiers;
        const normalized = normalizeBoxTiers(inputTiers);

        const tx = db.transaction(() => {
            db.prepare(`UPDATE keycard_price_tiers SET active = 0 WHERE lock_tech_id = ? AND active = 1`).run(lockTechId);

            const ins = db.prepare(`
        INSERT INTO keycard_price_tiers
          (lock_tech_id, min_boxes, max_boxes, currency, price_per_box_cents, active)
        VALUES
          (?, ?, ?, ?, ?, 1)
      `);

            for (const t of normalized) {
                ins.run(lockTechId, t.min_boxes, t.max_boxes, t.currency, t.price_per_box_cents);
            }
        });

        tx();

        const rows = db
            .prepare(
                `
        SELECT
          id,
          lock_tech_id,
          min_boxes,
          max_boxes,
          currency,
          price_per_box_cents,
          active,
          created_at
        FROM keycard_price_tiers
        WHERE lock_tech_id = ?
          AND active = 1
        ORDER BY min_boxes ASC, id ASC
      `
            )
            .all(lockTechId);

        res.json({
            ok: true,
            lock_tech_id: lockTechId,
            tiers: rows,
        });
    } catch (e) {
        // normalizeBoxTiers throws normal Error messages
        res.status(400).json({ error: e.message });
    }
};

// ------------------------
// DESIGNS + IMAGES
// (unchanged from your last setup; leaving here for completeness)
// ------------------------
function getDesignById(designId) {
    return db
        .prepare(
            `
      SELECT
        d.*,
        b.name AS brand_name,
        (
          SELECT url
          FROM images i
          WHERE i.entity_type = 'design' AND i.entity_id = d.id
          ORDER BY i.sort_order ASC, i.id ASC
          LIMIT 1
        ) AS image_url
      FROM keycard_designs d
      LEFT JOIN keycard_brands b ON b.id = d.brand_id
      WHERE d.id = ?
    `
        )
        .get(designId);
}

const listDesigns = (req, res) => {
    try {
        const activeParam = req.query.active;
        const active = activeParam === undefined ? null : asActive01(activeParam);
        if (activeParam !== undefined && active === null) {
            return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
        }

        const brandIdParam = req.query.brand_id;
        const brandId = brandIdParam === undefined ? null : asInt(brandIdParam);
        if (brandIdParam !== undefined && (brandId === null || brandId <= 0)) {
            return res.status(400).json({ error: "Invalid brand_id (expected a positive integer)." });
        }

        const rows = db
            .prepare(
                `
        SELECT
          d.*,
          b.name AS brand_name,
          (
            SELECT url
            FROM images i
            WHERE i.entity_type = 'design' AND i.entity_id = d.id
            ORDER BY i.sort_order ASC, i.id ASC
            LIMIT 1
          ) AS image_url
        FROM keycard_designs d
        LEFT JOIN keycard_brands b ON b.id = d.brand_id
        WHERE (? IS NULL OR d.active = ?)
          AND (? IS NULL OR d.brand_id = ?)
        ORDER BY d.created_at DESC, d.id DESC
      `
            )
            .all(active, active, brandId, brandId);

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const createDesign = (req, res) => {
    try {
        const brand_id = req.body?.brand_id === undefined ? null : asInt(req.body?.brand_id);
        if (req.body?.brand_id !== undefined && (brand_id === null || brand_id <= 0)) {
            return res.status(400).json({ error: "Invalid brand_id (expected a positive integer)." });
        }

        const code = asTrimmedString(req.body?.code);
        const name = asTrimmedString(req.body?.name);
        const description =
            req.body?.description === undefined || req.body?.description === null
                ? null
                : String(req.body.description);

        if (!code) return res.status(400).json({ error: "code is required." });
        if (!name) return res.status(400).json({ error: "name is required." });

        const tx = db.transaction(() => {
            const info = db
                .prepare(
                    `INSERT INTO keycard_designs (brand_id, code, name, description, active)
           VALUES (?, ?, ?, ?, 1)`
                )
                .run(brand_id, code, name, description);

            const designId = Number(info.lastInsertRowid);
            const url = `https://picsum.photos/seed/lts-keycard-design-${designId}/1200/800`;

            db.prepare(
                `INSERT INTO images (entity_type, entity_id, url, alt_text, sort_order)
         VALUES ('design', ?, ?, ?, 0)`
            ).run(designId, url, name);

            return designId;
        });

        const designId = tx();
        const row = getDesignById(designId);
        res.status(201).json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Design code already exists." });
        res.status(500).json({ error: e.message });
    }
};

const updateDesign = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const brand_id =
            req.body?.brand_id === undefined ? undefined : req.body?.brand_id === null ? null : asInt(req.body?.brand_id);
        const code = req.body?.code === undefined ? undefined : asTrimmedString(req.body?.code);
        const name = req.body?.name === undefined ? undefined : asTrimmedString(req.body?.name);
        const description = req.body?.description === undefined ? undefined : req.body?.description === null ? null : String(req.body?.description);
        const active = req.body?.active === undefined ? undefined : asActive01(req.body?.active);

        if (req.body?.brand_id !== undefined && brand_id !== null && (brand_id === null || brand_id <= 0)) {
            return res.status(400).json({ error: "Invalid brand_id (expected a positive integer or null)." });
        }
        if (req.body?.code !== undefined && !code) return res.status(400).json({ error: "code cannot be empty." });
        if (req.body?.name !== undefined && !name) return res.status(400).json({ error: "name cannot be empty." });
        if (req.body?.active !== undefined && active === null) return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });

        const sets = [];
        const params = [];

        if (brand_id !== undefined) { sets.push("brand_id = ?"); params.push(brand_id); }
        if (code !== undefined) { sets.push("code = ?"); params.push(code); }
        if (name !== undefined) { sets.push("name = ?"); params.push(name); }
        if (description !== undefined) { sets.push("description = ?"); params.push(description); }
        if (active !== undefined) { sets.push("active = ?"); params.push(active); }

        if (!sets.length) return res.status(400).json({ error: "No valid fields to update." });

        params.push(id);
        const info = db.prepare(`UPDATE keycard_designs SET ${sets.join(", ")} WHERE id = ?`).run(...params);
        if (info.changes === 0) return res.status(404).json({ error: "Design not found." });

        const row = getDesignById(id);
        res.json(row);
    } catch (e) {
        if (sqliteIsUniqueConstraint(e)) return res.status(409).json({ error: "Design code already exists." });
        res.status(500).json({ error: e.message });
    }
};

const deleteDesign = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const tx = db.transaction(() => {
            db.prepare(`DELETE FROM images WHERE entity_type = 'design' AND entity_id = ?`).run(id);
            return db.prepare(`DELETE FROM keycard_designs WHERE id = ?`).run(id);
        });

        const info = tx();
        if (info.changes === 0) return res.status(404).json({ error: "Design not found." });

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const addDesignImage = (req, res) => {
    try {
        const id = asInt(req.params.id);
        if (!id || id <= 0) return res.status(400).json({ error: "Invalid id." });

        const existing = db.prepare(`SELECT id, name FROM keycard_designs WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Design not found." });

        const url =
            asTrimmedString(req.body?.url) ||
            `https://picsum.photos/seed/lts-keycard-design-${id}-${Date.now()}/1200/800`;

        db.prepare(
            `INSERT INTO images (entity_type, entity_id, url, alt_text, sort_order)
       VALUES ('design', ?, ?, ?, 0)`
        ).run(id, url, existing.name);

        res.status(201).json({ ok: true, url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = {
    // brands
    listBrands,
    createBrand,
    updateBrand,
    deleteBrand,

    // lock tech
    listLockTech,
    createLockTech,
    updateLockTech,
    deleteLockTech,

    // tiers
    listTiersForLockTech,
    replaceTiersForLockTech,

    // designs
    listDesigns,
    createDesign,
    updateDesign,
    deleteDesign,
    addDesignImage,
};
