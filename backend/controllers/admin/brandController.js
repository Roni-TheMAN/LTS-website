const { db } = require("../../db");

function cleanName(v) {
  return (v ?? "").toString().trim();
}

function parseActive(v, defaultValue = 1) {
  if (v === undefined || v === null || v === "") return defaultValue;
  const n = Number(v);
  if (n === 0 || n === 1) return n;
  return null;
}

// GET /api/admin/brands?active=1 (optional)
const getAllBrands = (req, res) => {
  try {
    const active = req.query.active;

    let rows;
    if (active === "0" || active === "1") {
      rows = db
        .prepare(`SELECT * FROM brands WHERE active = ? ORDER BY name ASC`)
        .all(Number(active));
    } else {
      rows = db.prepare(`SELECT * FROM brands ORDER BY name ASC`).all();
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/admin/brands
// body: { name: string, active?: 0|1 }
const createBrand = (req, res) => {
  try {
    const body = req.body || {};
    const name = cleanName(body.name);
    if (!name) return res.status(400).json({ error: "Brand name is required." });

    const active = parseActive(body.active, 1);
    if (active === null) {
      return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
    }

    const ins = db
      .prepare(`INSERT INTO brands (name, active) VALUES (?, ?)`)
      .run(name, active);

    const row = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(ins.lastInsertRowid);
    return res.status(201).json(row);
  } catch (e) {
    const msg = (e?.message || "").toString();
    if (msg.includes("UNIQUE constraint failed") && msg.includes("brands.name")) {
      return res.status(409).json({ error: "Brand name already exists." });
    }
    return res.status(500).json({ error: msg || "Failed to create brand." });
  }
};

// PATCH /api/admin/brands/:id
// body: { name?: string, active?: 0|1 } (active=0 means archived)
const updateBrand = (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id (expected a positive integer)." });
    }

    const existing = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: "Brand not found." });

    const body = req.body || {};
    const sets = [];
    const params = [];

    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: "Brand name cannot be empty." });
      sets.push("name = ?");
      params.push(name);
    }

    if (body.active !== undefined) {
      const active = parseActive(body.active, existing.active);
      if (active === null) {
        return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
      }
      sets.push("active = ?");
      params.push(active);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    db.prepare(`UPDATE brands SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);

    const row = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(id);
    return res.json(row);
  } catch (e) {
    const msg = (e?.message || "").toString();
    if (msg.includes("UNIQUE constraint failed") && msg.includes("brands.name")) {
      return res.status(409).json({ error: "Brand name already exists." });
    }
    return res.status(500).json({ error: msg || "Failed to update brand." });
  }
};

module.exports = { getAllBrands, createBrand, updateBrand };
