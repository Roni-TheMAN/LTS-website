// backend/services/public/stripe/public/buildLineItemsFromCart.js
// CommonJS module
//
// Requires a better-sqlite3-like "db" with: db.prepare(sql).get(...), .all(...)
//
// IMPORTANT:
// - Never trust price/unit_amount/stripe_price_id from frontend
// - This derives everything from your SQLite DB

const tax_id = process.env.TAX_ID


class CartBuildError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.name = "CartBuildError";
        this.status = status;
        this.details = details;
    }
}

function toPosInt(value, label) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new CartBuildError(`${label} must be a positive integer.`);
    return n;
}

function toLowerStr(v, fallback = "") {
    return (v ?? fallback).toString().trim().toLowerCase();
}

function makeAbsoluteUrl(url, assetsBaseUrl) {
    const u = (url ?? "").toString().trim();
    if (!u) return null;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;

    // If you store relative paths, prefix them
    const base = (assetsBaseUrl ?? "").toString().trim();
    if (!base) return u; // might not work for Stripe images, but don't crash
    return base.replace(/\/$/, "") + (u.startsWith("/") ? u : `/${u}`);
}

/**
 * Build Stripe Checkout line_items from cart items, deriving pricing from DB.
 *
 * @param {object} db - better-sqlite3 db handle
 * @param {Array<any>} items - req.body.items
 * @param {object} [opts]
 * @param {string} [opts.assetsBaseUrl] - prefix for relative image URLs (e.g. "https://api.yoursite.com")
 * @param {string} [opts.defaultCurrency] - default currency if needed ("usd")
 * @returns {{ line_items: any[], currency: string }}
 */
function buildLineItemsFromCart(db, items, opts = {}) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new CartBuildError("Cart is empty or items is not an array.", 400);
    }

    const assetsBaseUrl = opts.assetsBaseUrl;
    const defaultCurrency = toLowerStr(opts.defaultCurrency, "usd");

    let sessionCurrency = null;
    const line_items = [];

    // Prepared statements (faster + safer)
    const stmtVariantJoin = db.prepare(`
    SELECT
      p.id            AS product_id,
      p.type          AS product_type,
      p.active        AS product_active,
      v.id            AS variant_id,
      v.active        AS variant_active
    FROM variants v
    JOIN products p ON p.id = v.product_id
    WHERE p.id = ? AND v.id = ?
    LIMIT 1
  `);

    const stmtVariantTier = db.prepare(`
    SELECT
      vp.id,
      vp.currency,
      vp.unit_amount_cents,
      vp.stripe_price_id
    FROM variant_prices vp
    WHERE vp.variant_id = ?
      AND vp.active = 1
      AND vp.min_qty <= ?
      AND (vp.max_qty IS NULL OR vp.max_qty >= ?)
    ORDER BY vp.min_qty DESC, vp.id DESC
    LIMIT 1
  `);

    const stmtDesign = db.prepare(`
    SELECT id, brand_id, code, name, description, active
    FROM keycard_designs
    WHERE id = ?
    LIMIT 1
  `);

    const stmtLockTech = db.prepare(`
    SELECT id, name, active
    FROM lock_tech
    WHERE id = ?
    LIMIT 1
  `);

    const stmtKeycardTier = db.prepare(`
    SELECT
      id,
      currency,
      price_per_box_cents
    FROM keycard_price_tiers
    WHERE lock_tech_id = ?
      AND active = 1
      AND min_boxes <= ?
      AND (max_boxes IS NULL OR max_boxes >= ?)
    ORDER BY min_boxes DESC, id DESC
    LIMIT 1
  `);

    const stmtDesignImages = db.prepare(`
    SELECT url
    FROM images
    WHERE entity_type = 'design'
      AND entity_id = ?
    ORDER BY sort_order ASC, id ASC
    LIMIT 8
  `);

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const kind = toLowerStr(it.kind);

        if (kind !== "product" && kind !== "keycard") {
            throw new CartBuildError(`items[${i}].kind must be "product" or "keycard".`);
        }

        const qty = toPosInt(it.quantity, `items[${i}].quantity`);

        if (kind === "product") {
            const product_id = toPosInt(it.product_id, `items[${i}].product_id`);
            const variant_id = toPosInt(it.variant_id, `items[${i}].variant_id`);

            // Verify variant belongs to product and both are active
            const pv = stmtVariantJoin.get(product_id, variant_id);
            if (!pv) {
                throw new CartBuildError(
                    `Product/Variant mismatch or not found for product_id=${product_id}, variant_id=${variant_id}.`,
                    400
                );
            }
            if (pv.product_active !== 1 || pv.variant_active !== 1) {
                throw new CartBuildError(
                    `Product or variant is archived/inactive for product_id=${product_id}, variant_id=${variant_id}.`,
                    409
                );
            }
            if (pv.product_type !== "regular") {
                throw new CartBuildError(
                    `product_id=${product_id} is not a regular product (type=${pv.product_type}).`,
                    400
                );
            }

            // Pick correct tier by qty
            const tier = stmtVariantTier.get(variant_id, qty, qty);
            if (!tier) {
                throw new CartBuildError(
                    `No active tier found for variant_id=${variant_id} at quantity=${qty}.`,
                    409
                );
            }

            const currency = toLowerStr(tier.currency, defaultCurrency);
            if (!sessionCurrency) sessionCurrency = currency;
            if (sessionCurrency !== currency) {
                throw new CartBuildError(
                    `Mixed currencies in cart are not allowed (got ${currency}, expected ${sessionCurrency}).`,
                    400
                );
            }

            const stripe_price_id = (tier.stripe_price_id ?? "").toString().trim();
            if (!stripe_price_id) {
                // You *can* fallback to price_data here, but that defeats your "derive stripe price id" requirement.
                throw new CartBuildError(
                    `Missing stripe_price_id for variant_id=${variant_id} tier_id=${tier.id}. Sync Stripe prices first.`,
                    409
                );
            }

            line_items.push({
                price: stripe_price_id,
                quantity: qty,
                tax_rates: [tax_id],
            });

            continue;
        }

        // kind === "keycard"
        const design_id = toPosInt(it.design_id, `items[${i}].design_id`);
        const lock_tech_id = toPosInt(it.lock_tech_id, `items[${i}].lock_tech_id`);
        const boxes = qty; // quantity for keycards is boxes

        const design = stmtDesign.get(design_id);
        if (!design) throw new CartBuildError(`Design not found: design_id=${design_id}.`, 400);
        if (design.active !== 1) throw new CartBuildError(`Design is archived/inactive: design_id=${design_id}.`, 409);

        const lockTech = stmtLockTech.get(lock_tech_id);
        if (!lockTech) throw new CartBuildError(`Lock tech not found: lock_tech_id=${lock_tech_id}.`, 400);
        if (lockTech.active !== 1) throw new CartBuildError(`Lock tech is archived/inactive: lock_tech_id=${lock_tech_id}.`, 409);

        const tier = stmtKeycardTier.get(lock_tech_id, boxes, boxes);
        if (!tier) {
            throw new CartBuildError(
                `No active keycard tier found for lock_tech_id=${lock_tech_id} at boxes=${boxes}.`,
                409
            );
        }

        const currency = toLowerStr(tier.currency, defaultCurrency);
        if (!sessionCurrency) sessionCurrency = currency;
        if (sessionCurrency !== currency) {
            throw new CartBuildError(
                `Mixed currencies in cart are not allowed (got ${currency}, expected ${sessionCurrency}).`,
                400
            );
        }

        const rawImgs = stmtDesignImages.all(design_id) || [];
        const images = rawImgs
            .map((r) => makeAbsoluteUrl(r.url, assetsBaseUrl))
            .filter((u) => typeof u === "string" && u.startsWith("https://")); // only https

// If none are valid, images will be omitted

        // Stripe requires publicly reachable image URLs (localhost won't work unless tunneled)
        const name = `${design.name} — ${lockTech.name}`;
        const description = (design.description ?? "").toString().trim() || undefined;

        line_items.push({
            price_data: {
                currency,
                product_data: {
                    name,
                    ...(description ? { description } : {}),
                    ...(images.length ? { images } : {}),
                    metadata: {
                        kind: "keycard",
                        design_id: String(design_id),
                        lock_tech_id: String(lock_tech_id),
                        design_code: String(design.code ?? ""),
                        brand_id: String(design.brand_id ?? ""),
                        cards_per_box: "200",
                    },
                },
                unit_amount: toPosInt(tier.price_per_box_cents, `keycard tier price_per_box_cents`),
            },
            quantity: boxes,
            tax_rates: [tax_id]
        });
    }

    return {
        line_items,
        currency: sessionCurrency ?? defaultCurrency,
    };
}

module.exports = {
    CartBuildError,
    buildLineItemsFromCart,
};
