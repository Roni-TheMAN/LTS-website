// backend/controllers/productController.js
const { db } = require("../../db");
const { createStripeProduct, updateStripeProduct } = require("../../services/admin/stripe/stripeProducts");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const baseProductSelect = `
  SELECT
    p.*,
    b.name AS brand_name,
    c.name AS category_name,
    (
      SELECT COUNT(*)
      FROM variants v
      WHERE v.product_id = p.id AND v.active = 1
    ) AS variants_count
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
`;

function toStripeActive(activeInt) {
    // 1 = active, everything else treated as inactive on Stripe
    return Number(activeInt) === 1;
}

function safeErrMsg(e) {
    const msg =
        (e && typeof e === "object" && e.message) ? String(e.message) : String(e);
    // keep it sane for DB
    return msg.length > 1000 ? msg.slice(0, 1000) : msg;
}

function setStripeSyncPending(productId) {
    db.prepare(`
    UPDATE products
    SET stripe_sync_status = 'pending',
        stripe_sync_error = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(productId);
}

function setStripeSyncResult({ productId, status, error = null, stripeProductId = undefined }) {
    const sets = ["stripe_sync_status = ?", "stripe_sync_error = ?", "updated_at = datetime('now')"];
    const values = [status, error];

    if (stripeProductId !== undefined) {
        sets.push("stripe_product_id = ?");
        values.push(stripeProductId);
    }

    values.push(productId);

    db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

async function syncProductToStripe({ productId, stripe_product_id, name, description, active }) {
    // mark pending first (DB is now the source of truth for "in progress")
    setStripeSyncPending(productId);

    try {
        if (stripe_product_id) {

            await sleep(2000);        // The function pauses here for 2 seconds


// Outside the function, other code continues to run without waiting.

            await updateStripeProduct({
                id: stripe_product_id,
                name,
                description,
                active: toStripeActive(active),
            });

            setStripeSyncResult({
                productId,
                status: "synced",
                error: null,
            });

            return { stripe_product_id };
        }

        const created = await createStripeProduct({
            name,
            description,
            active: toStripeActive(active),
        });

        setStripeSyncResult({
            productId,
            status: "synced",
            error: null,
            stripeProductId: created.id,
        });

        return { stripe_product_id: created.id };
    } catch (e) {
        setStripeSyncResult({
            productId,
            status: "failed",
            error: safeErrMsg(e),
        });

        return { stripe_product_id: stripe_product_id || null };
    }
}

const getAllProducts = (req, res) => {
    try {
        const rows = db
            .prepare(
                `
          ${baseProductSelect}
          ORDER BY p.created_at DESC, p.id DESC
        `
            )
            .all();

        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

const getProductById = (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: "Invalid product id" });
        }

        const row = db
            .prepare(
                `
          ${baseProductSelect}
          WHERE p.id = ?
        `
            )
            .get(id);

        if (!row) return res.status(404).json({ error: "Product not found" });

        return res.json(row);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

// PATCH /api/products/:id
// Supports: active, name, type, description, brand_id, category_id, stripe_product_id
// Stripe sync fields (stripe_sync_status, stripe_sync_error) are INTERNAL and updated automatically.
const updateProduct = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const body = req.body || {};

        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: "Invalid product id" });
        }

        const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
        if (!existing) {
            return res.status(404).json({ error: "Product not found" });
        }

        const sets = [];
        const values = [];

        // Build "next" for Stripe sync (merge existing + incoming)
        const next = {
            name: existing.name,
            description: existing.description,
            active: existing.active,
            stripe_product_id: existing.stripe_product_id,
        };

        // Stripe-relevant changes
        let needsStripeSync = false;

        // active (0/1/2)
        if (Object.prototype.hasOwnProperty.call(body, "active")) {
            const nextActive = Number(body.active);
            if (!Number.isInteger(nextActive) || ![0, 1, 2].includes(nextActive)) {
                return res.status(400).json({ error: "active must be 0, 1, or 2" });
            }
            sets.push("active = ?");
            values.push(nextActive);
            next.active = nextActive;
            needsStripeSync = true;
        }

        // type ('regular'|'keycard')
        if (Object.prototype.hasOwnProperty.call(body, "type")) {
            const type = (body.type ?? "").toString().trim().toLowerCase();
            if (!["regular", "keycard"].includes(type)) {
                return res.status(400).json({ error: "type must be 'regular' or 'keycard'" });
            }
            sets.push("type = ?");
            values.push(type);
            // type doesn't affect Stripe product object here
        }

        // name
        if (Object.prototype.hasOwnProperty.call(body, "name")) {
            const name = (body.name ?? "").toString().trim();
            if (!name) return res.status(400).json({ error: "name is required" });
            sets.push("name = ?");
            values.push(name);
            next.name = name;
            needsStripeSync = true;
        }

        // description (nullable)
        if (Object.prototype.hasOwnProperty.call(body, "description")) {
            const desc =
                body.description === undefined || body.description === null || body.description === ""
                    ? null
                    : body.description.toString();
            sets.push("description = ?");
            values.push(desc);
            next.description = desc;
            needsStripeSync = true;
        }

        // brand_id (nullable, must exist if not null)
        if (Object.prototype.hasOwnProperty.call(body, "brand_id")) {
            const raw = body.brand_id;
            const brand_id = raw === undefined || raw === null || raw === "" ? null : Number(raw);

            if (brand_id !== null && !Number.isInteger(brand_id)) {
                return res.status(400).json({ error: "brand_id must be an integer or null" });
            }
            if (brand_id !== null) {
                const exists = db.prepare(`SELECT 1 FROM brands WHERE id = ?`).get(brand_id);
                if (!exists) return res.status(400).json({ error: "Invalid brand_id (not found)" });
            }

            sets.push("brand_id = ?");
            values.push(brand_id);
        }

        // category_id (nullable, must exist if not null)
        if (Object.prototype.hasOwnProperty.call(body, "category_id")) {
            const raw = body.category_id;
            const category_id = raw === undefined || raw === null || raw === "" ? null : Number(raw);

            if (category_id !== null && !Number.isInteger(category_id)) {
                return res.status(400).json({ error: "category_id must be an integer or null" });
            }
            if (category_id !== null) {
                const exists = db.prepare(`SELECT 1 FROM categories WHERE id = ?`).get(category_id);
                if (!exists) return res.status(400).json({ error: "Invalid category_id (not found)" });
            }

            sets.push("category_id = ?");
            values.push(category_id);
        }

        // stripe_product_id (nullable) — if user sets/remaps it, we try to push current data to that Stripe product
        if (Object.prototype.hasOwnProperty.call(body, "stripe_product_id")) {
            const stripe_product_id =
                body.stripe_product_id === undefined || body.stripe_product_id === null || body.stripe_product_id === ""
                    ? null
                    : body.stripe_product_id.toString();

            sets.push("stripe_product_id = ?");
            values.push(stripe_product_id);
            next.stripe_product_id = stripe_product_id;
            needsStripeSync = true;
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: "No valid fields to update" });
        }

        // always bump updated_at if anything changes
        sets.push("updated_at = datetime('now')");

        const sql = `UPDATE products SET ${sets.join(", ")} WHERE id = ?`;
        values.push(id);

        const result = db.prepare(sql).run(...values);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Stripe sync if relevant fields changed
        if (needsStripeSync) {
            await syncProductToStripe({
                productId: id,
                stripe_product_id: next.stripe_product_id,
                name: next.name,
                description: next.description,
                active: next.active,
            });
        }

        const row = db
            .prepare(
                `
          ${baseProductSelect}
          WHERE p.id = ?
        `
            )
            .get(id);

        return res.json(row);
    } catch (e) {
        if (e && typeof e === "object" && String(e.code || "").startsWith("SQLITE_CONSTRAINT")) {
            return res.status(400).json({ error: e.message });
        }
        return res.status(500).json({ error: e.message });
    }
};

// POST /api/products
// Creates DB row immediately with stripe_sync_status='pending', then attempts Stripe create/update,
// then flips stripe_sync_status to 'synced' or 'failed' and stores stripe_sync_error.
const addProduct = async (req, res) => {
    try {
        const body = req.body || {};

        const type = (body.type ?? "").toString().trim().toLowerCase();
        const name = (body.name ?? "").toString().trim();
        const description =
            body.description === undefined || body.description === null
                ? null
                : body.description.toString();

        const activeRaw = body.active;
        const active =
            activeRaw === undefined || activeRaw === null || activeRaw === ""
                ? 1
                : Number(activeRaw);

        const brandIdRaw = body.brand_id;
        const categoryIdRaw = body.category_id;

        const brand_id =
            brandIdRaw === undefined || brandIdRaw === null || brandIdRaw === ""
                ? null
                : Number(brandIdRaw);

        const category_id =
            categoryIdRaw === undefined || categoryIdRaw === null || categoryIdRaw === ""
                ? null
                : Number(categoryIdRaw);

        const stripe_product_id =
            body.stripe_product_id === undefined || body.stripe_product_id === null || body.stripe_product_id === ""
                ? null
                : body.stripe_product_id.toString();

        if (!["regular", "keycard"].includes(type)) {
            return res.status(400).json({ error: "type must be 'regular' or 'keycard'" });
        }
        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        if (!Number.isInteger(active) || ![0, 1, 2].includes(active)) {
            return res.status(400).json({ error: "active must be 0, 1, or 2" });
        }
        if (brand_id !== null && !Number.isInteger(brand_id)) {
            return res.status(400).json({ error: "brand_id must be an integer or null" });
        }
        if (category_id !== null && !Number.isInteger(category_id)) {
            return res.status(400).json({ error: "category_id must be an integer or null" });
        }

        if (brand_id !== null) {
            const exists = db.prepare(`SELECT 1 FROM brands WHERE id = ?`).get(brand_id);
            if (!exists) return res.status(400).json({ error: "Invalid brand_id (not found)" });
        }
        if (category_id !== null) {
            const exists = db.prepare(`SELECT 1 FROM categories WHERE id = ?`).get(category_id);
            if (!exists) return res.status(400).json({ error: "Invalid category_id (not found)" });
        }

        // Insert immediately as pending (requirement)
        const insert = db.prepare(`
      INSERT INTO products (
        type,
        name,
        description,
        active,
        brand_id,
        category_id,
        stripe_product_id,
        stripe_sync_status,
        stripe_sync_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL)
    `);

        const info = insert.run(type, name, description, active, brand_id, category_id, stripe_product_id);
        const id = Number(info.lastInsertRowid);

        // Try to sync to Stripe (create if no stripe_product_id; otherwise update existing)
        await syncProductToStripe({
            productId: id,
            stripe_product_id,
            name,
            description,
            active,
        });

        const row = db
            .prepare(
                `
          ${baseProductSelect}
          WHERE p.id = ?
        `
            )
            .get(id);

        return res.status(201).json(row);
    } catch (e) {
        if (e && typeof e === "object" && String(e.code || "").startsWith("SQLITE_CONSTRAINT")) {
            return res.status(400).json({ error: e.message });
        }
        return res.status(500).json({ error: e.message });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    updateProduct,
    addProduct,
};
