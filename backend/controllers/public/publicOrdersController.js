// controllers/public/publicOrdersController.js
"use strict";

/**
 * Public controller:
 * - Lookup order (NO list) by (order_number + email + zip)
 * - Fetch by stripe session id (cs_...) for return page
 *
 * SECURITY NOTE:
 * Public "fetch list" is a scraping nightmare. Public should ONLY allow lookup.
 */

function getDb() {
    // Adjust this to your project.
    // Common patterns:
    //   module.exports = db;
    //   module.exports = { db };
    const mod = require("../../db");
    return mod.db || mod;
}

const db = getDb();

/**
 * FIX: helpers to avoid "getParam is not defined"
 */
function getParam(req, key) {
    // Prefer body (POST JSON), then querystring (GET), then params (/:id)
    if (req?.body && typeof req.body === "object" && req.body[key] != null) return req.body[key];
    if (req?.query && req.query[key] != null) return req.query[key];
    if (req?.params && req.params[key] != null) return req.params[key];
    return undefined;
}

function normalizePostalCode(v) {
    if (v == null) return "";
    // Normalize to compare reliably: trim, uppercase, strip spaces/dashes/etc.
    return String(v).trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function safeJsonStringify(val) {
    if (val === undefined || val === null) return null;
    try {
        return typeof val === "string" ? val : JSON.stringify(val);
    } catch {
        return null;
    }
}

function safeJsonParse(s) {
    if (!s) return {};
    try {
        return JSON.parse(s);
    } catch {
        return {};
    }
}

/**
 * Stripe helper (path may differ in your project)
 */
const stripe = require("../../services/stripeClient");

// Returns { receipt_url, hosted_invoice_url, invoice_pdf } (any can be null)
async function fetchReceiptBundleForSession(sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent.latest_charge", "invoice"],
    });

    let invoice_pdf = null;
    let hosted_invoice_url = null;
    let receipt_url = null;

    // invoice (if enabled/created)
    if (session.invoice) {
        if (typeof session.invoice === "object") {
            invoice_pdf = session.invoice.invoice_pdf || null;
            hosted_invoice_url = session.invoice.hosted_invoice_url || null;
        } else if (typeof session.invoice === "string") {
            const inv = await stripe.invoices.retrieve(session.invoice);
            invoice_pdf = inv.invoice_pdf || null;
            hosted_invoice_url = inv.hosted_invoice_url || null;
        }
    }

    // receipt_url lives on the Charge (via PaymentIntent.latest_charge)
    const pi = session.payment_intent;
    if (pi && typeof pi === "object") {
        receipt_url = pi.latest_charge?.receipt_url || null;
    } else if (typeof pi === "string") {
        const charges = await stripe.charges.list({ payment_intent: pi, limit: 1 });
        receipt_url = charges.data?.[0]?.receipt_url || null;
    }

    return { receipt_url, hosted_invoice_url, invoice_pdf };
}

/**
 * Public shape for an order (don’t leak internal-only fields)
 * NOTE: your schema replaced `status` with 4 status columns:
 * - order_status, payment_status, fulfillment_status, shipping_status
 */
function sanitizeOrderForPublic(orderRow, itemRows) {
    const statuses = {
        order_status: orderRow.order_status,
        payment_status: orderRow.payment_status,
        fulfillment_status: orderRow.fulfillment_status,
        shipping_status: orderRow.shipping_status,
    };

    return {
        id: orderRow.id,
        order_number: orderRow.order_number,

        // Backwards-compat summary (old UI expects `status`)
        // Map it to payment_status so you still see "pending"/"paid"/"refunded".
        status: orderRow.payment_status,

        ...statuses,

        source: orderRow.source,
        payment_method: orderRow.payment_method,

        currency: orderRow.currency,
        subtotal_cents: orderRow.subtotal_cents,
        tax_cents: orderRow.tax_cents,
        shipping_cents: orderRow.shipping_cents,
        total_cents: orderRow.total_cents,

        created_at: orderRow.created_at,
        paid_at: orderRow.paid_at,
        updated_at: orderRow.updated_at,

        customer: {
            email: orderRow.customer_email,
            name: orderRow.customer_name,
            phone: orderRow.customer_phone,
        },

        shipping: {
            ship_name: orderRow.ship_name,
            ship_line1: orderRow.ship_line1,
            ship_line2: orderRow.ship_line2,
            ship_city: orderRow.ship_city,
            ship_state: orderRow.ship_state,
            ship_postal_code: orderRow.ship_postal_code,
            ship_country: orderRow.ship_country,
        },

        items: itemRows.map((it) => ({
            id: it.id,
            item_type: it.item_type,
            product_id: it.product_id,
            variant_id: it.variant_id,
            design_id: it.design_id,
            lock_tech_id: it.lock_tech_id,
            box_size: it.box_size,
            boxes: it.boxes,
            currency: it.currency,
            unit_amount_cents: it.unit_amount_cents,
            quantity: it.quantity,
            line_total_cents: it.line_total_cents,
            description: it.description,
            // keep metadata private by default; enable if you want:
            // metadata_json: it.metadata_json,
        })),
    };
}

/**
 * Shared: attach receipt bundle for paid orders (cached in metadata_json)
 */
async function maybeAttachReceipt(orderRow) {
    let receipt = null;

    // Only fetch/cache receipts when payment is paid (adjust if you want refunded too)
    if (orderRow.payment_status === "paid" && orderRow.stripe_checkout_session_id) {
        const meta = safeJsonParse(orderRow.metadata_json);

        const cached = meta?.stripe?.receipt;
        const hasCached =
            cached && (cached.invoice_pdf || cached.hosted_invoice_url || cached.receipt_url);

        if (hasCached) {
            receipt = {
                invoice_pdf: null, //cached.invoice_pdf ||
                hosted_invoice_url: null, //cached.hosted_invoice_url ||
                receipt_url: cached.receipt_url || null,
            };
            return receipt;
        }

        try {
            const bundle = await fetchReceiptBundleForSession(orderRow.stripe_checkout_session_id);
            const hasAny = bundle && (bundle.invoice_pdf || bundle.hosted_invoice_url || bundle.receipt_url);

            if (hasAny) {
                receipt = {
                    invoice_pdf: null, //bundle.invoice_pdf ||
                    hosted_invoice_url: null, //bundle.hosted_invoice_url ||
                    receipt_url: bundle.receipt_url || null,
                };

                meta.stripe = meta.stripe || {};
                meta.stripe.receipt = receipt;

                db.prepare(`UPDATE orders SET metadata_json = ?, updated_at = datetime('now') WHERE id = ?`).run(
                    JSON.stringify(meta),
                    orderRow.id
                );
            }
        } catch {
            // don't fail lookup if Stripe fetch fails
            receipt = null;
        }
    }

    return receipt;
}

/**
 * POST/GET /api/public/orders/lookup
 * Supports:
 *   - POST body { order_number, email, zip }
 *   - GET query ?order_number=...&email=...&zip=...
 *
 * ZIP must match either shipping or billing ZIP (prevents easy enumeration).
 */
async function lookupOrder(req, res) {
    try {
        const order_number = String(getParam(req, "order_number") || "").trim();
        const email = String(getParam(req, "email") || "").trim().toLowerCase();
        const zip = String(getParam(req, "zip") || "").trim();

        if (!order_number) throw new Error("order_number is required");
        if (!email) throw new Error("email is required");
        if (!zip) throw new Error("zip is required");

        const order = db
            .prepare(
                `SELECT *
         FROM orders
         WHERE order_number = ?
           AND lower(customer_email) = ?
         LIMIT 1`
            )
            .get(order_number, email);

        // generic to prevent enumeration
        if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

        const inputZip = normalizePostalCode(zip);
        const shipZip = normalizePostalCode(order.ship_postal_code);
        const billZip = normalizePostalCode(order.bill_postal_code);

        // ZIP must match either shipping or billing ZIP
        if (!inputZip || (inputZip !== shipZip && inputZip !== billZip)) {
            return res.status(404).json({ ok: false, error: "Order not found" });
        }

        const items = db
            .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`)
            .all(order.id);

        const publicOrder = sanitizeOrderForPublic(order, items);
        publicOrder.receipt = await maybeAttachReceipt(order); // { invoice_pdf, hosted_invoice_url, receipt_url } or null

        return res.json({ ok: true, order: publicOrder });
    } catch (err) {
        return res.status(400).json({ ok: false, error: err?.message || "Bad Request" });
    }
}

/**
 * GET /api/public/orders/by-session/:sessionId
 * Handy for Stripe return page when all you have is cs_...
 */
async function getBySession(req, res) {
    try {
        const sessionId = String(req.params.sessionId || "").trim();
        if (!sessionId.startsWith("cs_")) throw new Error("Invalid session id");

        const order = db
            .prepare(`SELECT * FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1`)
            .get(sessionId);

        if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

        const items = db
            .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`)
            .all(order.id);

        const publicOrder = sanitizeOrderForPublic(order, items);
        publicOrder.receipt = await maybeAttachReceipt(order);

        return res.json({ ok: true, order: publicOrder });
    } catch (err) {
        return res.status(400).json({ ok: false, error: err?.message || "Bad Request" });
    }
}

module.exports = {
    lookupOrder,
    getBySession,
};
