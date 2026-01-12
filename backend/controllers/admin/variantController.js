// backend/controllers/variantController.js
const { db } = require("../../db");
const { createStripePrice } = require("../../services/admin/stripe/stripePrices");
const stripe = require("../../services/stripeClient");

// -----------------------------
// small helpers
// -----------------------------
function asPosInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function asNullableText(v) {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
}

function asActiveInt(v) {
    if (v === undefined) return undefined;
    const n = Number(v);
    // allow 0/1 today; also allow 2 for future archive state
    if (!Number.isInteger(n) || n < 0 || n > 2) return null;
    return n;
}

function asCurrency(v) {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim().toLowerCase();
    return s ? s : undefined;
}

function safeErrMsg(e) {
    const msg =
        e && typeof e === "object" && e.message ? String(e.message) : String(e);
    return msg.length > 1000 ? msg.slice(0, 1000) : msg;
}

// helper: fetch one variant w/ counts
function getVariantRowById(variantId) {
    return db
        .prepare(
            `
                SELECT
                    v.*,
                    (
                        SELECT COUNT(*)
                        FROM variant_prices vp
                        WHERE vp.variant_id = v.id AND vp.active = 1
                    ) AS prices_count,
                    (
                        SELECT COUNT(*)
                        FROM images i
                        WHERE i.entity_type = 'variant' AND i.entity_id = v.id
                    ) AS images_count
                FROM variants v
                WHERE v.id = ?
            `
        )
        .get(variantId);
}

function getStripeProductIdForProduct(productId) {
    const row = db
        .prepare(`SELECT stripe_product_id FROM products WHERE id = ?`)
        .get(productId);
    return row?.stripe_product_id ? String(row.stripe_product_id) : null;
}

function getStripeProductIdForVariant(variantId) {
    const row = db
        .prepare(
            `
                SELECT p.stripe_product_id
                FROM variants v
                         JOIN products p ON p.id = v.product_id
                WHERE v.id = ?
            `
        )
        .get(variantId);

    return row?.stripe_product_id ? String(row.stripe_product_id) : null;
}

// -----------------------------
// Stripe sync helpers (variant_prices)
// -----------------------------
function setVariantPriceSyncPending(priceRowId) {
    db.prepare(
        `
            UPDATE variant_prices
            SET stripe_sync_status = 'pending',
                stripe_sync_error = NULL
            WHERE id = ?
        `
    ).run(priceRowId);
}

function setVariantPriceSyncResult({
                                       priceRowId,
                                       status,
                                       error = null,
                                       stripePriceId = undefined,
                                   }) {
    const sets = ["stripe_sync_status = ?", "stripe_sync_error = ?"];
    const params = [status, error];

    if (stripePriceId !== undefined) {
        sets.push("stripe_price_id = ?");
        params.push(stripePriceId);
    }

    params.push(priceRowId);
    db.prepare(`UPDATE variant_prices SET ${sets.join(", ")} WHERE id = ?`).run(
        ...params
    );
}

async function syncCreateVariantPriceToStripe({
                                                  priceRowId,
                                                  stripeProductId,
                                                  unitAmountCents,
                                                  currency,
                                              }) {
    // mark pending immediately (requirement)
    setVariantPriceSyncPending(priceRowId);

    if (!stripeProductId) {
        setVariantPriceSyncResult({
            priceRowId,
            status: "failed",
            error:
                "Cannot create Stripe Price: product.stripe_product_id is NULL (product not linked/synced to Stripe).",
        });
        return;
    }

    try {
        const created = await createStripePrice({
            stripeProductId,
            unitAmountCents,
            currency: currency || "usd",
        });

        setVariantPriceSyncResult({
            priceRowId,
            status: "synced",
            error: null,
            stripePriceId: created.id,
        });
    } catch (e) {
        setVariantPriceSyncResult({
            priceRowId,
            status: "failed",
            error: safeErrMsg(e),
        });
    }
}

async function archiveStripePrice(stripePriceId) {
    return stripe.prices.update(String(stripePriceId), { active: false });
}

// We reuse stripe_sync_status/error to track the archive attempt on OLD rows (inactive rows).
async function archiveVariantPriceOnStripe({ priceRowId, stripePriceId }) {
    if (!stripePriceId) return;

    // mark pending for archive attempt
    setVariantPriceSyncPending(priceRowId);

    try {
        await archiveStripePrice(stripePriceId);
        setVariantPriceSyncResult({
            priceRowId,
            status: "synced",
            error: null,
        });
    } catch (e) {
        setVariantPriceSyncResult({
            priceRowId,
            status: "failed",
            error: `Archive failed: ${safeErrMsg(e)}`,
        });
    }
}

// -----------------------------
// Tier normalization (NO gaps, NO overlaps)
// - Treat tiers as BREAKPOINTS: min_qty + price
// - Ignore client max_qty, recompute it from next min_qty
// -----------------------------
function normalizeVariantPriceTiers(rawTiers, currencyFallback = "usd") {
    if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
        return { ok: false, error: "tiers must be a non-empty array." };
    }
    if (rawTiers.length > 50) {
        return { ok: false, error: "Too many tiers (max 50)." };
    }

    let tiers = rawTiers.map((t) => {
        const min = Math.max(1, Math.floor(Number(t?.min_qty)));
        const cents = Math.floor(Number(t?.unit_amount_cents));

        if (!Number.isFinite(min)) return { bad: "min_qty must be a number." };
        if (!Number.isFinite(cents))
            return { bad: "unit_amount_cents must be a number." };
        if (cents < 0) return { bad: "unit_amount_cents cannot be negative." };

        const ccy = asCurrency(t?.currency) || currencyFallback;

        return { min_qty: min, unit_amount_cents: cents, currency: ccy };
    });

    const bad = tiers.find((t) => t && t.bad);
    if (bad) return { ok: false, error: bad.bad };

    // sort by min
    tiers.sort((a, b) => a.min_qty - b.min_qty);

    // dedupe mins (keep last)
    const dedup = [];
    for (const t of tiers) {
        const last = dedup[dedup.length - 1];
        if (last && last.min_qty === t.min_qty) dedup[dedup.length - 1] = t;
        else dedup.push(t);
    }

    // enforce first starts at 1
    dedup[0].min_qty = 1;

    // enforce strictly increasing mins
    for (let i = 1; i < dedup.length; i++) {
        const prev = dedup[i - 1].min_qty;
        if (dedup[i].min_qty <= prev) dedup[i].min_qty = prev + 1;
    }

    // compute max from next min
    const normalized = dedup.map((t, i) => {
        const next = dedup[i + 1];
        return {
            min_qty: t.min_qty,
            max_qty: next ? next.min_qty - 1 : null,
            currency: t.currency || currencyFallback,
            unit_amount_cents: t.unit_amount_cents,
        };
    });

    return { ok: true, tiers: normalized };
}

// -----------------------------
// GET variants by product id
// GET /api/variants/product/:productId?active=0|1|2|all
// -----------------------------
const getVariantsByProductId = (req, res) => {
    try {
        const productId = asPosInt(req.params.productId);
        if (!productId) {
            return res
                .status(400)
                .json({ error: "Invalid product id (expected a positive integer)." });
        }

        const activeFilterRaw = req.query.active;
        let rows;

        if (
            activeFilterRaw === undefined ||
            activeFilterRaw === "" ||
            activeFilterRaw === "all"
        ) {
            rows = db
                .prepare(
                    `
                        SELECT
                            v.*,
                            (
                                SELECT COUNT(*)
                                FROM variant_prices vp
                                WHERE vp.variant_id = v.id AND vp.active = 1
                            ) AS prices_count,
                            (
                                SELECT COUNT(*)
                                FROM images i
                                WHERE i.entity_type = 'variant' AND i.entity_id = v.id
                            ) AS images_count
                        FROM variants v
                        WHERE v.product_id = ?
                        ORDER BY v.id DESC
                    `
                )
                .all(productId);
        } else {
            const activeFilter = asActiveInt(activeFilterRaw);
            if (activeFilter === null) {
                return res.status(400).json({
                    error: "Invalid active filter (expected 0, 1, 2, or 'all').",
                });
            }

            rows = db
                .prepare(
                    `
                        SELECT
                            v.*,
                            (
                                SELECT COUNT(*)
                                FROM variant_prices vp
                                WHERE vp.variant_id = v.id AND vp.active = 1
                            ) AS prices_count,
                            (
                                SELECT COUNT(*)
                                FROM images i
                                WHERE i.entity_type = 'variant' AND i.entity_id = v.id
                            ) AS images_count
                        FROM variants v
                        WHERE v.product_id = ? AND v.active = ?
                        ORDER BY v.id DESC
                    `
                )
                .all(productId, activeFilter);
        }

        return res.json(rows);
    } catch (e) {
        console.error("getVariantsByProductId error:", e);
        return res.status(500).json({ error: "Failed to fetch variants." });
    }
};

// -----------------------------
// GET variant by id
// GET /api/variants/:variantId
// -----------------------------
const getVariantById = (req, res) => {
    try {
        const variantId = asPosInt(req.params.variantId);
        if (!variantId) {
            return res
                .status(400)
                .json({ error: "Invalid variant id (expected a positive integer)." });
        }

        const row = getVariantRowById(variantId);
        if (!row) return res.status(404).json({ error: "Variant not found." });

        return res.json(row);
    } catch (e) {
        console.error("getVariantById error:", e);
        return res.status(500).json({ error: "Failed to fetch variant." });
    }
};

// -----------------------------
// CREATE variant + starting price row
// POST /api/variants/product/:productId
// body: { name, sku, starting_price, description? }
// also accepts starting_price_cents (optional) and currency (optional, default "usd")
// -----------------------------
const createVariant = async (req, res) => {
    try {
        const productId = asPosInt(req.params.productId);
        if (!productId) {
            return res
                .status(400)
                .json({ error: "Invalid product id (expected a positive integer)." });
        }

        const body = req.body || {};
        const name = body.name !== undefined ? String(body.name).trim() : "";
        const sku = body.sku !== undefined ? String(body.sku).trim() : "";
        const description = asNullableText(body.description);

        if (!name) return res.status(400).json({ error: "Missing name." });
        if (!sku) return res.status(400).json({ error: "Missing sku." });

        const currency = asCurrency(body.currency) || "usd";

        let unitAmountCents;
        if (
            body.starting_price_cents !== undefined &&
            body.starting_price_cents !== null
        ) {
            const cents = Number(body.starting_price_cents);
            if (!Number.isInteger(cents) || cents <= 0) {
                return res
                    .status(400)
                    .json({ error: "starting_price_cents must be a positive integer." });
            }
            unitAmountCents = cents;
        } else {
            const startingPrice = Number(body.starting_price);
            if (!Number.isFinite(startingPrice) || startingPrice <= 0) {
                return res.status(400).json({
                    error: "starting_price must be a positive number (e.g., 19.99).",
                });
            }
            unitAmountCents = Math.round(startingPrice * 100);
            if (unitAmountCents <= 0) {
                return res.status(400).json({ error: "starting_price is too small." });
            }
        }

        const tx = db.transaction(() => {
            // 1) insert variant
            const vInfo = db
                .prepare(
                    `
                        INSERT INTO variants (product_id, sku, name, description, active)
                        VALUES (?, ?, ?, ?, 1)
                    `
                )
                .run(productId, sku, name, description ?? null);

            const variantId = Number(vInfo.lastInsertRowid);

            // 2) insert starting tier immediately as pending
            const pInfo = db
                .prepare(
                    `
                        INSERT INTO variant_prices
                        (variant_id, min_qty, max_qty, currency, unit_amount_cents, active, stripe_price_id, stripe_sync_status, stripe_sync_error)
                        VALUES
                            (?, 1, NULL, ?, ?, 1, NULL, 'pending', NULL)
                    `
                )
                .run(variantId, currency, unitAmountCents);

            const priceRowId = Number(pInfo.lastInsertRowid);

            return { variantId, priceRowId };
        });

        const { variantId, priceRowId } = tx();

        // Stripe sync (outside transaction)
        const stripeProductId = getStripeProductIdForProduct(productId);
        await syncCreateVariantPriceToStripe({
            priceRowId,
            stripeProductId,
            unitAmountCents,
            currency,
        });

        const variant = getVariantRowById(variantId);
        return res.status(201).json(variant);
    } catch (e) {
        if (String(e?.code || "").startsWith("SQLITE_CONSTRAINT")) {
            return res.status(409).json({
                error: "Constraint failed (duplicate SKU or invalid foreign key).",
            });
        }
        console.error("createVariant error:", e);
        return res.status(500).json({ error: "Failed to create variant." });
    }
};

// -----------------------------
// UPDATE variant (toggle + future edits)
// PATCH /api/variants/:variantId
// body: any of { product_id, sku, name, description, active }
// also accepts ?active=0|1|2 for quick toggles
// -----------------------------
const updateVariant = (req, res) => {
    try {
        const variantId = asPosInt(req.params.variantId);
        if (!variantId) {
            return res.status(400).json({
                error: "Invalid id (expected a positive integer variant id).",
            });
        }

        const existing = getVariantRowById(variantId);
        if (!existing) return res.status(404).json({ error: "Variant not found." });

        const body = req.body || {};
        const activeFromQuery =
            req.query.active !== undefined ? req.query.active : undefined;

        const next = {
            product_id:
                body.product_id !== undefined ? asPosInt(body.product_id) : undefined,
            sku: asNullableText(body.sku),
            name: body.name !== undefined ? String(body.name).trim() : undefined,
            description: asNullableText(body.description),
            active:
                body.active !== undefined
                    ? asActiveInt(body.active)
                    : activeFromQuery !== undefined
                        ? asActiveInt(activeFromQuery)
                        : undefined,
        };

        if (next.product_id === null) {
            return res
                .status(400)
                .json({ error: "Invalid product_id (expected a positive integer)." });
        }
        if (next.name !== undefined && next.name.length === 0) {
            return res.status(400).json({ error: "Invalid name (cannot be empty)." });
        }
        if (next.active === null) {
            return res
                .status(400)
                .json({ error: "Invalid active (expected 0, 1, or 2)." });
        }

        const sets = [];
        const params = [];

        if (next.product_id !== undefined) {
            sets.push("product_id = ?");
            params.push(next.product_id);
        }
        if (next.sku !== undefined) {
            sets.push("sku = ?");
            params.push(next.sku);
        }
        if (next.name !== undefined) {
            sets.push("name = ?");
            params.push(next.name);
        }
        if (next.description !== undefined) {
            sets.push("description = ?");
            params.push(next.description);
        }
        if (next.active !== undefined) {
            sets.push("active = ?");
            params.push(next.active);
        }

        if (sets.length === 0) {
            return res.status(400).json({
                error:
                    "No updatable fields provided. Send product_id, sku, name, description, and/or active.",
            });
        }

        params.push(variantId);
        db.prepare(`UPDATE variants SET ${sets.join(", ")} WHERE id = ?`).run(
            ...params
        );

        const updated = getVariantRowById(variantId);
        return res.json(updated);
    } catch (e) {
        if (String(e?.code || "").startsWith("SQLITE_CONSTRAINT")) {
            return res.status(409).json({
                error: "Constraint failed (duplicate SKU or invalid foreign key).",
            });
        }
        console.error("updateVariant error:", e);
        return res.status(500).json({ error: "Failed to update variant." });
    }
};

// ============================================================
// TIERED PRICING CONTROLLERS
// ============================================================

// -----------------------------
// GET tiers for variant
// GET /api/variants/:variantId/prices?active=1|all
// -----------------------------
const getVariantPrices = (req, res) => {
    try {
        const variantId = asPosInt(req.params.variantId);
        if (!variantId) {
            return res.status(400).json({
                error: "Invalid variant id (expected a positive integer).",
            });
        }

        const variant = getVariantRowById(variantId);
        if (!variant) return res.status(404).json({ error: "Variant not found." });

        const activeRaw = req.query.active;
        const activeOnly =
            activeRaw === undefined || activeRaw === "" || String(activeRaw) === "1";
        const includeAll = String(activeRaw) === "all";

        let rows;
        if (includeAll) {
            rows = db
                .prepare(
                    `
                        SELECT *
                        FROM variant_prices
                        WHERE variant_id = ?
                        ORDER BY min_qty ASC, id ASC
                    `
                )
                .all(variantId);
        } else if (activeOnly) {
            rows = db
                .prepare(
                    `
                        SELECT *
                        FROM variant_prices
                        WHERE variant_id = ? AND active = 1
                        ORDER BY min_qty ASC, id ASC
                    `
                )
                .all(variantId);
        } else {
            const active = asActiveInt(activeRaw);
            if (active === null) {
                return res
                    .status(400)
                    .json({ error: "Invalid active (expected 0, 1, 2, or 'all')." });
            }
            rows = db
                .prepare(
                    `
                        SELECT *
                        FROM variant_prices
                        WHERE variant_id = ? AND active = ?
                        ORDER BY min_qty ASC, id ASC
                    `
                )
                .all(variantId, active);
        }

        return res.json(rows);
    } catch (e) {
        console.error("getVariantPrices error:", e);
        return res.status(500).json({ error: "Failed to fetch variant prices." });
    }
};

// -----------------------------
// Replace ALL tiers (robust normalization)
// PUT /api/variants/:variantId/prices
// body: { currency?: "usd", tiers: [{ min_qty, unit_amount_cents, currency? }, ...] }
// Server recomputes max_qty, inserts new rows as pending, syncs to Stripe,
// then archives old Stripe prices (deactivate) AFTER new prices are synced.
// -----------------------------
const replaceVariantPrices = async (req, res) => {
    try {
        const variantId = asPosInt(req.params.variantId);
        if (!variantId) {
            return res.status(400).json({
                error: "Invalid variant id (expected a positive integer).",
            });
        }

        const variant = getVariantRowById(variantId);
        if (!variant) return res.status(404).json({ error: "Variant not found." });

        const body = req.body || {};
        const currency = asCurrency(body.currency) || "usd";
        const rawTiers = Array.isArray(body) ? body : body.tiers;

        const norm = normalizeVariantPriceTiers(rawTiers, currency);
        if (!norm.ok) return res.status(400).json({ error: norm.error });
        const tiers = norm.tiers;

        // collect old active rows (for archiving their Stripe prices later)
        const oldRowsToArchive = db
            .prepare(
                `
        SELECT id, stripe_price_id
        FROM variant_prices
        WHERE variant_id = ?
          AND active = 1
          AND stripe_price_id IS NOT NULL
      `
            )
            .all(variantId)
            .map((r) => ({
                id: Number(r.id),
                stripe_price_id: String(r.stripe_price_id),
            }));

        // DB transaction: deactivate old tiers, insert new tiers as pending
        const tx = db.transaction(() => {
            db.prepare(
                `
        UPDATE variant_prices
        SET active = 0
        WHERE variant_id = ? AND active = 1
      `
            ).run(variantId);

            const ins = db.prepare(
                `
        INSERT INTO variant_prices
          (variant_id, min_qty, max_qty, currency, unit_amount_cents, active, stripe_price_id, stripe_sync_status, stripe_sync_error)
        VALUES
          (?, ?, ?, ?, ?, 1, NULL, 'pending', NULL)
      `
            );

            const created = [];
            for (const t of tiers) {
                const info = ins.run(
                    variantId,
                    t.min_qty,
                    t.max_qty,
                    t.currency || currency,
                    t.unit_amount_cents
                );
                created.push({
                    id: Number(info.lastInsertRowid),
                    unit_amount_cents: t.unit_amount_cents,
                    currency: t.currency || currency,
                });
            }

            return created;
        });

        const createdRows = tx();

        // Stripe create new prices (outside transaction)
        const stripeProductId = getStripeProductIdForVariant(variantId);
        for (const r of createdRows) {
            // eslint-disable-next-line no-await-in-loop
            await syncCreateVariantPriceToStripe({
                priceRowId: r.id,
                stripeProductId,
                unitAmountCents: r.unit_amount_cents,
                currency: r.currency,
            });
        }

        // Safety gate: only archive old Stripe prices if ALL new rows synced.
        // (Otherwise you could end up with no working active prices on Stripe.)
        const newStatuses = db
            .prepare(
                `
        SELECT id, stripe_sync_status
        FROM variant_prices
        WHERE id IN (${createdRows.map(() => "?").join(",")})
      `
            )
            .all(...createdRows.map((r) => r.id));

        const allNewSynced =
            newStatuses.length === createdRows.length &&
            newStatuses.every((r) => r.stripe_sync_status === "synced");

        if (allNewSynced && oldRowsToArchive.length > 0) {
            for (const old of oldRowsToArchive) {
                // eslint-disable-next-line no-await-in-loop
                await archiveVariantPriceOnStripe({
                    priceRowId: old.id,
                    stripePriceId: old.stripe_price_id,
                });
            }
        }

        // return NEW active tiers
        const rows = db
            .prepare(
                `
                    SELECT *
                    FROM variant_prices
                    WHERE variant_id = ? AND active = 1
                    ORDER BY min_qty ASC, id ASC
                `
            )
            .all(variantId);

        return res.json({ variant_id: variantId, tiers: rows });
    } catch (e) {
        if (String(e?.code || "").startsWith("SQLITE_CONSTRAINT")) {
            return res
                .status(409)
                .json({ error: "Constraint failed (check min/max, FK, etc.)." });
        }
        console.error("replaceVariantPrices error:", e);
        return res.status(500).json({ error: "Failed to save variant prices." });
    }
};

// -----------------------------
// Price lookup for qty (checkout helper)
// GET /api/variants/:variantId/price?qty=37
// -----------------------------
const getUnitPriceForQty = (req, res) => {
    try {
        const variantId = asPosInt(req.params.variantId);
        if (!variantId) {
            return res.status(400).json({
                error: "Invalid variant id (expected a positive integer).",
            });
        }

        const qty = asPosInt(req.query.qty);
        if (!qty) {
            return res
                .status(400)
                .json({ error: "Invalid qty (expected a positive integer)." });
        }

        const row = db
            .prepare(
                `
                    SELECT *
                    FROM variant_prices
                    WHERE variant_id = ?
                      AND active = 1
                      AND min_qty <= ?
                      AND (max_qty IS NULL OR max_qty >= ?)
                    ORDER BY min_qty DESC
                    LIMIT 1
                `
            )
            .get(variantId, qty, qty);

        if (!row) {
            return res
                .status(404)
                .json({ error: "No active price tier found for this qty." });
        }

        return res.json({
            variant_id: variantId,
            qty,
            unit_amount_cents: row.unit_amount_cents,
            currency: row.currency,
            tier: row,
        });
    } catch (e) {
        console.error("getUnitPriceForQty error:", e);
        return res.status(500).json({ error: "Failed to lookup price." });
    }
};

module.exports = {
    // variants
    getVariantsByProductId,
    getVariantById,
    createVariant,
    updateVariant,

    // tiered pricing
    getVariantPrices,
    replaceVariantPrices,
    getUnitPriceForQty,
};
