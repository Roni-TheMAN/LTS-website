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

function parseParentId(v) {
  if (v === undefined || v === null || v === "") return null; // clear / none
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return undefined; // invalid
  return n;
}

function parentExists(id) {
  if (id === null) return true;
  const row = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(id);
  return !!row;
}

// GET /api/admin/categories?active=1 (optional)
const getAllCategories = (req, res) => {
  try {
    const active = req.query.active;

    let rows;
    if (active === "0" || active === "1") {
      rows = db
        .prepare(`SELECT * FROM categories WHERE active = ? ORDER BY name ASC`)
        .all(Number(active));
    } else {
      rows = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all();
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/admin/categories
// body: { name: string, parent_id?: number|null, active?: 0|1 }
const createCategory = (req, res) => {
  try {
    const body = req.body || {};
    const name = cleanName(body.name);
    if (!name) return res.status(400).json({ error: "Category name is required." });

    const active = parseActive(body.active, 1);
    if (active === null) {
      return res.status(400).json({ error: "Invalid active (expected 0 or 1)." });
    }

    const parent_id = parseParentId(body.parent_id);
    if (parent_id === undefined) {
      return res.status(400).json({ error: "Invalid parent_id (expected a positive integer or null)." });
    }

    if (!parentExists(parent_id)) {
      return res.status(400).json({ error: "Parent category does not exist." });
    }

    const ins = db
      .prepare(`INSERT INTO categories (parent_id, name, active) VALUES (?, ?, ?)`)
      .run(parent_id, name, active);

    const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(ins.lastInsertRowid);
    return res.status(201).json(row);
  } catch (e) {
    return res.status(500).json({ error: (e?.message || "Failed to create category.").toString() });
  }
};

// PATCH /api/admin/categories/:id
// body: { name?: string, parent_id?: number|null, active?: 0|1 }
const updateCategory = (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id (expected a positive integer)." });
    }

    const existing = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: "Category not found." });

    const body = req.body || {};
    const sets = [];
    const params = [];

    if (body.name !== undefined) {
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: "Category name cannot be empty." });
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

    if (body.parent_id !== undefined) {
      const parent_id = parseParentId(body.parent_id);
      if (parent_id === undefined) {
        return res.status(400).json({ error: "Invalid parent_id (expected a positive integer or null)." });
      }

      if (parent_id === id) {
        return res.status(400).json({ error: "A category cannot be its own parent." });
      }

      if (!parentExists(parent_id)) {
        return res.status(400).json({ error: "Parent category does not exist." });
      }

      sets.push("parent_id = ?");
      params.push(parent_id);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);

    const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
    return res.json(row);
  } catch (e) {
    return res.status(500).json({ error: (e?.message || "Failed to update category.").toString() });
  }
};

module.exports = { getAllCategories, createCategory, updateCategory };
