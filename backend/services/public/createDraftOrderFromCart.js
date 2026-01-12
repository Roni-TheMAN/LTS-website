// backend/services/public/createDraftOrderFromCart.js
// CommonJS module
//
// INPUT: req.body.items (cart items)
// OUTPUT: { order_id, order_number, line_items, currency, subtotal_cents, total_cents }
//
// IMPORTANT:
// - NEVER trust price/unit_amount/stripe ids from frontend
// - We only trust product_id/variant_id/design_id/lock_tech_id/quantity and derive prices from DB.

const tax_id = process.env.TAX_ID;

class OrderDraftError extends Error {
    constructor(message, status = 400, details = null) {
        super(message);
        this.name = "OrderDraftError";
        this.status = status;
        this.details = details;
    }
}

function toPosInt(value, label) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new OrderDraftError(`${label} must be a positive integer.`, 400);
    return n;
}

function toLowerStr(v, fallback = "") {
    return (v ?? fallback).toString().trim().toLowerCase();
}

function safeTaxRates() {
    const t = (tax_id ?? "").toString().trim();
    return t ? [t] : undefined;
}

function makeAbsoluteUrl(url, assetsBaseUrl) {
    const u = (url ?? "").toString().trim();
    if (!u) return null;
    if (u.startsWith("http://") || u.startsWith("https://")) return u;

    const base = (assetsBaseUrl ?? "").toString().trim();
    if (!base) return u;
    return base.replace(/\/$/, "") + (u.startsWith("/") ? u : `/${u}`);
}

function firstImageUrl(db, entity_type, entity_id, assetsBaseUrl) {
    const row = db
        .prepare(
            `
                SELECT url
                FROM images
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY sort_order ASC, id ASC
                LIMIT 1
            `
        )
        .get(entity_type, entity_id);

    const abs = makeAbsoluteUrl(row?.url, assetsBaseUrl);
    // Stripe wants publicly reachable images (ideally https). If it's not https, skip it.
    return abs && abs.startsWith("https://") ? abs : null;
}

function assertOneOf(value, allowed, label) {
    if (!allowed.includes(value)) {
        throw new OrderDraftError(`${label} must be one of: ${allowed.join(", ")}. Got: ${value}`, 500);
    }
    return value;
}

function createDraftOrderFromCart(db, items, opts = {}) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new OrderDraftError("Cart is empty or items is not an array.", 400);
    }

    const assetsBaseUrl = opts.assetsBaseUrl;
    const defaultCurrency = toLowerStr(opts.defaultCurrency, "usd");
    const source = (opts.source ?? "web").toString().trim() || "web";
    const orderPrefix = (opts.orderPrefix ?? "LTS").toString().trim() || "LTS";

    // New schema split statuses (explicitly set them for a freshly created order)
    const order_status = assertOneOf(toLowerStr(opts.order_status, "placed"), ["placed", "cancelled", "completed"], "order_status");
    const payment_status = assertOneOf(toLowerStr(opts.payment_status, "pending"), ["pending", "paid", "refunded"], "payment_status");
    const fulfillment_status = assertOneOf(
        toLowerStr(opts.fulfillment_status, "unfulfilled"),
        ["unfulfilled", "fulfilled"],
        "fulfillment_status"
    );
    const shipping_status = assertOneOf(
        toLowerStr(opts.shipping_status, "pending"),
        ["pending", "shipped", "delivered"],
        "shipping_status"
    );
    const payment_method = assertOneOf(
        toLowerStr(opts.payment_method, "stripe"),
        ["stripe", "cash", "check", "invoice", "other"],
        "payment_method"
    );

    // -------- Prepared statements (like buildLineItemsFromCart) --------

    const stmtVariantJoin = db.prepare(`
    SELECT
      p.id               AS product_id,
      p.type             AS product_type,
      p.active           AS product_active,
      p.name             AS product_name,
      p.stripe_product_id AS stripe_product_id,

      v.id               AS variant_id,
      v.active           AS variant_active,
      v.name             AS variant_name,
      v.sku              AS variant_sku
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

    // -------- Resolve items -> Stripe line_items + order_items snapshot --------

    let sessionCurrency = null;
    const line_items = [];
    const resolvedItems = [];
    let subtotal_cents = 0;

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const kind = toLowerStr(it.kind);
        const qty = toPosInt(it.quantity, `items[${i}].quantity`);

        if (kind === "product") {
            const product_id = toPosInt(it.product_id, `items[${i}].product_id`);
            const variant_id = toPosInt(it.variant_id, `items[${i}].variant_id`);

            const pv = stmtVariantJoin.get(product_id, variant_id);
            if (!pv) {
                throw new OrderDraftError(
                    `Product/Variant mismatch or not found for product_id=${product_id}, variant_id=${variant_id}.`,
                    400
                );
            }
            if (pv.product_active !== 1 || pv.variant_active !== 1) {
                throw new OrderDraftError(
                    `Product or variant is archived/inactive for product_id=${product_id}, variant_id=${variant_id}.`,
                    409
                );
            }
            if (pv.product_type !== "regular") {
                throw new OrderDraftError(`product_id=${product_id} is not a regular product (type=${pv.product_type}).`, 400);
            }

            const tier = stmtVariantTier.get(variant_id, qty, qty);
            if (!tier) {
                throw new OrderDraftError(`No active tier found for variant_id=${variant_id} at quantity=${qty}.`, 409);
            }

            const currency = toLowerStr(tier.currency, defaultCurrency);
            if (!sessionCurrency) sessionCurrency = currency;
            if (sessionCurrency !== currency) {
                throw new OrderDraftError(
                    `Mixed currencies in cart are not allowed (got ${currency}, expected ${sessionCurrency}).`,
                    400
                );
            }

            const unit_amount_cents = Number(tier.unit_amount_cents);
            if (!Number.isInteger(unit_amount_cents) || unit_amount_cents < 0) {
                throw new OrderDraftError(`Bad unit_amount_cents in DB for variant_price id=${tier.id}.`, 500);
            }

            const line_total_cents = unit_amount_cents * qty;
            subtotal_cents += line_total_cents;

            const stripe_price_id = (tier.stripe_price_id ?? "").toString().trim();
            const taxRates = safeTaxRates();

            // Stripe line item: prefer price id; fallback to price_data if missing
            if (stripe_price_id) {
                line_items.push({
                    price: stripe_price_id,
                    quantity: qty,
                    ...(taxRates ? { tax_rates: taxRates } : {}),
                });
            } else {
                const image =
                    firstImageUrl(db, "variant", variant_id, assetsBaseUrl) ||
                    firstImageUrl(db, "product", product_id, assetsBaseUrl) ||
                    null;

                line_items.push({
                    price_data: {
                        currency,
                        unit_amount: unit_amount_cents,
                        product_data: {
                            name: `${pv.product_name} — ${pv.variant_name}`,
                            ...(image ? { images: [image] } : {}),
                            metadata: {
                                kind: "product",
                                product_id: String(product_id),
                                variant_id: String(variant_id),
                            },
                        },
                    },
                    quantity: qty,
                });
            }

            resolvedItems.push({
                item_type: "regular",
                product_id,
                variant_id,
                design_id: null,
                lock_tech_id: null,
                box_size: 200,
                boxes: null,

                price_source: "catalog",
                stripe_price_id: stripe_price_id || null,
                stripe_product_id: pv.stripe_product_id ?? null,

                currency,
                unit_amount_cents,
                quantity: qty,
                line_total_cents,

                description: `${pv.product_name} — ${pv.variant_name}${pv.variant_sku ? ` (${pv.variant_sku})` : ""}`,
                metadata_json: JSON.stringify({ kind: "product", variant_price_id: tier.id }),
            });

            continue;
        }

        if (kind === "keycard") {
            const design_id = toPosInt(it.design_id, `items[${i}].design_id`);
            const lock_tech_id = toPosInt(it.lock_tech_id, `items[${i}].lock_tech_id`);
            const boxes = qty;

            const design = stmtDesign.get(design_id);
            if (!design) throw new OrderDraftError(`Design not found: design_id=${design_id}.`, 400);
            if (design.active !== 1) throw new OrderDraftError(`Design is archived/inactive: design_id=${design_id}.`, 409);

            const lockTech = stmtLockTech.get(lock_tech_id);
            if (!lockTech) throw new OrderDraftError(`Lock tech not found: lock_tech_id=${lock_tech_id}.`, 400);
            if (lockTech.active !== 1) throw new OrderDraftError(`Lock tech is archived/inactive: lock_tech_id=${lock_tech_id}.`, 409);

            const tier = stmtKeycardTier.get(lock_tech_id, boxes, boxes);
            if (!tier) {
                throw new OrderDraftError(`No active keycard tier found for lock_tech_id=${lock_tech_id} at boxes=${boxes}.`, 409);
            }

            const currency = toLowerStr(tier.currency, defaultCurrency);
            if (!sessionCurrency) sessionCurrency = currency;
            if (sessionCurrency !== currency) {
                throw new OrderDraftError(
                    `Mixed currencies in cart are not allowed (got ${currency}, expected ${sessionCurrency}).`,
                    400
                );
            }

            const unit_amount_cents = Number(tier.price_per_box_cents);
            if (!Number.isInteger(unit_amount_cents) || unit_amount_cents < 0) {
                throw new OrderDraftError(`Bad price_per_box_cents in DB for keycard tier id=${tier.id}.`, 500);
            }

            const line_total_cents = unit_amount_cents * boxes;
            subtotal_cents += line_total_cents;

            const name = `${design.name} — ${lockTech.name}`;
            const description = (design.description ?? "").toString().trim() || undefined;

            const image = firstImageUrl(db, "design", design_id, assetsBaseUrl);
            const taxRates = safeTaxRates();

            // Keycards: always dynamic price_data
            line_items.push({
                price_data: {
                    currency,
                    unit_amount: unit_amount_cents,
                    product_data: {
                        name,
                        ...(description ? { description } : {}),
                        ...(image ? { images: [image] } : {}),
                        metadata: {
                            kind: "keycard",
                            design_id: String(design_id),
                            lock_tech_id: String(lock_tech_id),
                            design_code: String(design.code ?? ""),
                            cards_per_box: "200",
                        },
                    },
                },
                quantity: boxes,
                ...(taxRates ? { tax_rates: taxRates } : {}),
            });

            resolvedItems.push({
                item_type: "keycard",
                product_id: null,
                variant_id: null,
                design_id,
                lock_tech_id,
                box_size: 200,
                boxes,

                price_source: "catalog",
                stripe_price_id: null,
                stripe_product_id: null,

                currency,
                unit_amount_cents,
                quantity: boxes,
                line_total_cents,

                description: name,
                metadata_json: JSON.stringify({ kind: "keycard", keycard_tier_id: tier.id, design_code: design.code ?? "" }),
            });

            continue;
        }

        throw new OrderDraftError(`items[${i}].kind must be "product" or "keycard".`, 400);
    }

    const currency = sessionCurrency ?? defaultCurrency;

    // If you don’t want Stripe tax, keep these 0 and compute fees elsewhere.
    const tax_cents = 0;
    const shipping_cents = 0;
    const total_cents = subtotal_cents + tax_cents + shipping_cents;

    // -------- Insert orders + order_items in one transaction --------
    const tx = db.transaction(() => {
        const insOrder = db.prepare(`
      INSERT INTO orders (
        source,
        order_status,
        payment_status,
        fulfillment_status,
        shipping_status,
        payment_method,
        currency,
        subtotal_cents,
        tax_cents,
        shipping_cents,
        total_cents,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const orderMeta = {
            cart_snapshot: items.map((x) => ({
                kind: x.kind,
                product_id: x.product_id,
                variant_id: x.variant_id,
                design_id: x.design_id,
                lock_tech_id: x.lock_tech_id,
                quantity: x.quantity,
            })),
            created_at_iso: new Date().toISOString(),
        };

        const info = insOrder.run(
            source,
            order_status,
            payment_status,
            fulfillment_status,
            shipping_status,
            payment_method,
            currency,
            subtotal_cents,
            tax_cents,
            shipping_cents,
            total_cents,
            JSON.stringify(orderMeta)
        );

        const order_id = Number(info.lastInsertRowid);
        const year = new Date().getFullYear();
        const order_number = `${orderPrefix}-${year}-${String(order_id).padStart(6, "0")}`;

        db.prepare(`UPDATE orders SET order_number = ? WHERE id = ?`).run(order_number, order_id);

        const insItem = db.prepare(`
      INSERT INTO order_items (
        order_id,
        item_type,
        product_id,
        variant_id,
        design_id,
        lock_tech_id,
        box_size,
        boxes,
        price_source,
        stripe_price_id,
        stripe_product_id,
        currency,
        unit_amount_cents,
        quantity,
        line_total_cents,
        description,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        for (const r of resolvedItems) {
            insItem.run(
                order_id,
                r.item_type,
                r.product_id,
                r.variant_id,
                r.design_id,
                r.lock_tech_id,
                r.box_size ?? 200,
                r.boxes,
                r.price_source ?? "catalog",
                r.stripe_price_id,
                r.stripe_product_id,
                currency,
                r.unit_amount_cents,
                r.quantity,
                r.line_total_cents,
                r.description ?? null,
                r.metadata_json ?? null
            );
        }

        return {
            order_id,
            order_number,
            currency,
            subtotal_cents,
            tax_cents,
            shipping_cents,
            total_cents,
            line_items,
        };
    });

    return tx();
}

function attachSessionIdToOrder(db, order_id, session_id) {
    const id = toPosInt(order_id, "order_id");
    const sid = (session_id ?? "").toString().trim();
    if (!sid) throw new OrderDraftError("session_id missing.", 500);

    const info = db.prepare(`UPDATE orders SET stripe_checkout_session_id = ? WHERE id = ?`).run(sid, id);

    if (info.changes !== 1) {
        throw new OrderDraftError("Failed to update order with stripe_checkout_session_id.", 500, { order_id: id });
    }
}

module.exports = {
    OrderDraftError,
    createDraftOrderFromCart,
    attachSessionIdToOrder,
};
