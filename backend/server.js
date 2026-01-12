// // backend/server.js
// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();
// const { db } = require("./db");
//
//
// const stripe = require("./services/stripeClient")
// const { buildLineItemsFromCart, CartBuildError } = require("./services/public/buildLineItemsFromCart");
// const {
//     OrderDraftError,
//     createDraftOrderFromCart,
//     attachSessionIdToOrder,
// } = require("./services/public/createDraftOrderFromCart");
// const stripeWebhookHandler = require("./services/public/stripeWebhook");
//
//
//
// const imageRoutes = require("./routes/admin/imageRoutes");
// const { IMAGES_ROOT } = require("./services/admin/cloudflare/imageStorage");
//
//
//
//
//
//
// const app = express();
// const port = process.env.PORT || 5000;
//
// const allowedOrigins = new Set([
//     "http://localhost:3000",
//     "http://localhost:3001",
//
// ]);
//
// function isNgrok(origin) {
//     return typeof origin === "string" && /^https?:\/\/.*\.ngrok-free\.app$/.test(origin);
// }
//
//
// const YOUR_DOMAIN = process.env.FRONTEND_URL
//
//
// app.use(
//     cors({
//         origin: (origin, cb) => {
//             if (!origin) return cb(null, true); // curl/postman/no-origin
//             if (allowedOrigins.has(origin) || isNgrok(origin)) return cb(null, true);
//             return cb(new Error(`CORS blocked for origin: ${origin}`));
//         },
//         credentials: true,
//     })
// );
//
//
// // ✅ Stripe webhook MUST come before express.json()
// // Stripe needs the raw body to verify Stripe-Signature
// app.post(
//     "/api/public/stripe/webhook",
//     express.raw({ type: "application/json" }),
//     stripeWebhookHandler({ db, stripe })
// );
//
//
// app.use(express.json());
//
// app.use("/images", express.static(IMAGES_ROOT));
// app.use("/api/admin/images", imageRoutes);
//
// // =====================
// // PUBLIC (client website)
// // =====================
// app.use("/api/public/brands", require("./routes/public/brandRoutes"));
// app.use("/api/public/categories", require("./routes/public/categoryRoutes"));
// app.use("/api/public/products", require("./routes/public/productRoutes"));
// app.use("/api/public/keycards", require("./routes/public/keycardRoutes")); // ✅ add this
// app.use("/api/public/orders", require("./routes/public/publicOrdersRoutes"));
//
//
//
//
//
//
// // =====================
// // Stripe (client website)
// // =====================
//
// app.post("/create-checkout-session", async (req, res) => {
//     try {
//         const { items } = req.body || {};
//
//         // 1) Create draft order + order_items AND get Stripe line_items from DB truth
//         const draft = createDraftOrderFromCart(db, items, {
//             assetsBaseUrl: process.env.PUBLIC_BACKEND_URL, // must be public https for Stripe images
//             defaultCurrency: "usd",
//             source: "web",
//             orderPrefix: "LTS",
//         });
//
//         const session = await stripe.checkout.sessions.create({
//             ui_mode: "embedded",
//             billing_address_collection: "required",
//             invoice_creation: { enabled: false },
//             shipping_address_collection: { allowed_countries: ["US", "CA"] },
//             phone_number_collection: {
//                 enabled: true,
//             },
//             shipping_options: [
//                 {
//                     shipping_rate: 'shr_1SmmLWRtCj14FHacnmj0GT0X',
//                 },
//             ],
//             name_collection: {
//                 business: {
//                     enabled: true,
//                     optional: true
//                 },
//                 individual: {
//                     enabled: true,
//                     optional: false,
//                 },
//             },
//             mode: "payment",
//             line_items: draft.line_items,
//
//             // strong linkage (helps later when you add webhook)
//             client_reference_id: draft.order_number,
//             metadata: {
//                 order_id: String(draft.order_id),
//                 order_number: draft.order_number,
//             },
//
//             return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
//         });
//
//         // 2) Attach session id to order
//         attachSessionIdToOrder(db, draft.order_id, session.id);
//
//         res.send({
//             clientSecret: session.client_secret,
//             orderId: draft.order_id,
//             orderNumber: draft.order_number,
//         });
//     } catch (err) {
//         const status = err?.status || 500;
//         res.status(status).json({
//             error: err?.message || "Server error",
//             details: err?.details || null,
//         });
//     }
// });
//
// app.get('/session-status', async (req, res) => {
//     const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
//
//     res.send({
//         status: session.status,
//         customer_email: session.customer_details?.email ?? null,
//         payment_status: session.payment_status,
//         order_number: session.metadata?.order_number ?? null,
//         amount_subtotal: session.amount_subtotal ?? null,
//         amount_total: session.amount_total ?? null,
//
//         // ✅ add these
//         amount_tax: session.total_details?.amount_tax ?? null,
//         amount_shipping: session.total_details?.amount_shipping ?? null,
//         total_details: session.total_details ?? null,
//
//         customer_name: session.customer_details?.name ?? null,
//         business_name: session.customer_details?.name ?? null,
//         shipping_details: session.collected_information?.shipping_details ?? null,
//     });
// });
//
//
//
//
//
//
// // =====================
// // ADMIN (protected later)
// // =====================
// app.use("/api/admin/products", require("./routes/admin/productRoutes"));
// app.use("/api/admin/brands", require("./routes/admin/brandRoutes"));
// app.use("/api/admin/categories", require("./routes/admin/categoryRoutes"));
// app.use("/api/admin/variants", require("./routes/admin/variantRoutes"));
// app.use("/api/admin/keycards", require("./routes/admin/keycardRoutes"));
// app.use("/api/search", require("./routes/admin/searchRoutes"));
// app.use("/api/admin/orders", require("./routes/admin/adminOrdersRoutes"));
//
//
//
//
//
// app.listen(port, () => {
//     console.log(`Server started on port ${port}`);
// });


// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { db } = require("./db");

const stripe = require("./services/stripeClient");
const {
    buildLineItemsFromCart,
    CartBuildError,
} = require("./services/public/buildLineItemsFromCart");
const {
    OrderDraftError,
    createDraftOrderFromCart,
    attachSessionIdToOrder,
} = require("./services/public/createDraftOrderFromCart");
const stripeWebhookHandler = require("./services/public/stripeWebhook");

const imageRoutes = require("./routes/admin/imageRoutes");
const { IMAGES_ROOT } = require("./services/admin/cloudflare/imageStorage");

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = new Set(["http://localhost:3000", "http://localhost:3001"]);

function isNgrok(origin) {
    return typeof origin === "string" && /^https?:\/\/.*\.ngrok-free\.app$/.test(origin);
}

const YOUR_DOMAIN = process.env.FRONTEND_URL;

// Admin panel base URL for Stripe return_url (set this!)
const ADMIN_DOMAIN =
    process.env.ADMIN_URL ||
    process.env.ADMIN_PANEL_URL ||
    process.env.FRONTEND_ADMIN_URL ||
    "http://localhost:3000";

function toPublicAssetUrl(url) {
    if (!url) return null;
    const u = String(url).trim();
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;

    const base = String(process.env.PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
    if (!base) return null;

    if (u.startsWith("/")) return `${base}${u}`;
    return `${base}/${u}`;
}

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true); // curl/postman/no-origin
            if (allowedOrigins.has(origin) || isNgrok(origin)) return cb(null, true);
            return cb(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    })
);

// ✅ Stripe webhook MUST come before express.json()
// Stripe needs the raw body to verify Stripe-Signature
app.post(
    "/api/public/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookHandler({ db, stripe })
);

app.use(express.json());

app.use("/images", express.static(IMAGES_ROOT));
app.use("/api/admin/images", imageRoutes);

// =====================
// PUBLIC (client website)
// =====================
app.use("/api/public/brands", require("./routes/public/brandRoutes"));
app.use("/api/public/categories", require("./routes/public/categoryRoutes"));
app.use("/api/public/products", require("./routes/public/productRoutes"));
app.use("/api/public/keycards", require("./routes/public/keycardRoutes"));
app.use("/api/public/orders", require("./routes/public/publicOrdersRoutes"));

// =====================
// Stripe (client website)
// =====================
app.post("/create-checkout-session", async (req, res) => {
    try {
        const { items } = req.body || {};

        // 1) Create draft order + order_items AND get Stripe line_items from DB truth
        const draft = createDraftOrderFromCart(db, items, {
            assetsBaseUrl: process.env.PUBLIC_BACKEND_URL, // must be public https for Stripe images
            defaultCurrency: "usd",
            source: "web",
            orderPrefix: "LTS",
        });

        const session = await stripe.checkout.sessions.create({
            ui_mode: "embedded",
            billing_address_collection: "required",
            invoice_creation: { enabled: false },
            shipping_address_collection: { allowed_countries: ["US", "CA"] },
            phone_number_collection: {
                enabled: true,
            },
            shipping_options: [
                {
                    shipping_rate: "shr_1SmmLWRtCj14FHacnmj0GT0X",
                },
            ],
            name_collection: {
                business: {
                    enabled: true,
                    optional: true,
                },
                individual: {
                    enabled: true,
                    optional: false,
                },
            },
            mode: "payment",
            line_items: draft.line_items,

            // strong linkage (helps later when you add webhook)
            client_reference_id: draft.order_number,
            metadata: {
                order_id: String(draft.order_id),
                order_number: draft.order_number,
                source: "web",
            },

            return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
        });

        // 2) Attach session id to order
        attachSessionIdToOrder(db, draft.order_id, session.id);

        res.send({
            clientSecret: session.client_secret,
            orderId: draft.order_id,
            orderNumber: draft.order_number,
        });
    } catch (err) {
        const status = err?.status || 500;
        res.status(status).json({
            error: err?.message || "Server error",
            details: err?.details || null,
        });
    }
});

async function sessionStatusHandler(req, res) {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

    res.send({
        status: session.status,
        customer_email: session.customer_details?.email ?? null,
        payment_status: session.payment_status,
        order_number: session.metadata?.order_number ?? null,
        order_id: session.metadata?.order_id ?? null,

        amount_subtotal: session.amount_subtotal ?? null,
        amount_total: session.amount_total ?? null,

        amount_tax: session.total_details?.amount_tax ?? null,
        amount_shipping: session.total_details?.amount_shipping ?? null,
        total_details: session.total_details ?? null,

        customer_name: session.customer_details?.name ?? null,
        business_name: session.customer_details?.name ?? null,
        shipping_details: session.collected_information?.shipping_details ?? null,
    });
}

app.get("/session-status", sessionStatusHandler);

// =====================
// ADMIN Stripe Checkout
// =====================
// POST body: { orderId: number }
// Returns: { clientSecret, sessionId, orderId, orderNumber }
async function adminCreateCheckoutSessionHandler(req, res) {
    try {
        const orderIdRaw = req.body?.orderId ?? req.body?.id ?? req.query?.orderId ?? req.query?.id;
        const orderId = Number(orderIdRaw);
        if (!Number.isFinite(orderId) || orderId <= 0) {
            return res.status(400).json({ error: "Valid orderId is required." });
        }

        const order = db
            .prepare(
                `
        SELECT
          id,
          order_number,
          currency,
          tax_cents,
          shipping_cents,
          total_cents,
          payment_status,
          customer_email,
          stripe_checkout_session_id
        FROM orders
        WHERE id = ?
      `
            )
            .get(orderId);

        if (!order) return res.status(404).json({ error: "Order not found." });

        // If already paid, don't create another session.
        if (String(order.payment_status || "").toLowerCase() === "paid") {
            return res.status(400).json({ error: "Order is already marked paid." });
        }

        // If an existing session is still open, reuse it (prevents creating 20 sessions).
        if (order.stripe_checkout_session_id) {
            try {
                const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
                if (existing?.status === "open" && existing?.client_secret) {
                    return res.json({
                        clientSecret: existing.client_secret,
                        sessionId: existing.id,
                        orderId: order.id,
                        orderNumber: order.order_number,
                        reused: true,
                    });
                }
            } catch (_) {
                // ignore and create a new one
            }
        }

        const items = db
            .prepare(
                `
        SELECT
          oi.*,
          p.name  AS product_name,
          v.name  AS variant_name,
          kd.name AS design_name,
          lt.name AS lock_tech_name,
          img_p.url AS product_image_url,
          img_d.url AS design_image_url
        FROM order_items oi
          LEFT JOIN products p         ON p.id  = oi.product_id
          LEFT JOIN variants v         ON v.id  = oi.variant_id
          LEFT JOIN keycard_designs kd ON kd.id = oi.design_id
          LEFT JOIN lock_tech lt       ON lt.id = oi.lock_tech_id
          LEFT JOIN images img_p       ON img_p.id = (
            SELECT i2.id
            FROM images i2
            WHERE i2.entity_type = 'product'
              AND i2.entity_id   = oi.product_id
              AND i2.sort_order  = 0
            ORDER BY i2.id ASC
            LIMIT 1
          )
          LEFT JOIN images img_d       ON img_d.id = (
            SELECT i3.id
            FROM images i3
            WHERE i3.entity_type = 'design'
              AND i3.entity_id   = oi.design_id
              AND i3.sort_order  = 0
            ORDER BY i3.id ASC
            LIMIT 1
          )
        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
      `
            )
            .all(orderId);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Order has no items." });
        }

        const currency = String(order.currency || "usd").toLowerCase();

        const line_items = items.map((it) => {
            const itemType = String(it.item_type || "regular").toLowerCase();

            const title =
                itemType === "keycard"
                    ? ["Keycards", it.design_name, it.lock_tech_name].filter(Boolean).join(" — ") || "Keycards"
                    : [it.product_name, it.variant_name].filter(Boolean).join(" — ") ||
                    String(it.description || "Item").slice(0, 120);

            const rawImg = itemType === "keycard" ? it.design_image_url : it.product_image_url;
            const img = toPublicAssetUrl(rawImg);

            const unit_amount = Number(it.unit_amount_cents);
            const qty = Number(it.quantity);

            if (!Number.isFinite(unit_amount) || unit_amount < 0) {
                const err = new Error(`Invalid unit_amount_cents for order_item ${it.id}`);
                err.status = 400;
                throw err;
            }
            if (!Number.isFinite(qty) || qty <= 0) {
                const err = new Error(`Invalid quantity for order_item ${it.id}`);
                err.status = 400;
                throw err;
            }

            return {
                quantity: qty,
                price_data: {
                    currency: String(it.currency || currency).toLowerCase(),
                    unit_amount: unit_amount,
                    product_data: {
                        name: title,
                        ...(it.description ? { description: String(it.description).slice(0, 400) } : {}),
                        ...(img ? { images: [img] } : {}),
                        metadata: {
                            order_id: String(order.id),
                            order_item_id: String(it.id),
                            item_type: String(it.item_type || ""),
                            variant_id: it.variant_id ? String(it.variant_id) : "",
                            design_id: it.design_id ? String(it.design_id) : "",
                            lock_tech_id: it.lock_tech_id ? String(it.lock_tech_id) : "",
                        },
                    },
                },
            };
        });

        // Add shipping/tax as explicit line items so Stripe total matches your manual order totals.
        const shippingCents = Number(order.shipping_cents || 0);
        if (Number.isFinite(shippingCents) && shippingCents > 0) {
            line_items.push({
                quantity: 1,
                price_data: {
                    currency,
                    unit_amount: shippingCents,
                    product_data: { name: "Shipping" },
                },
            });
        }

        const taxCents = Number(order.tax_cents || 0);
        if (Number.isFinite(taxCents) && taxCents > 0) {
            line_items.push({
                quantity: 1,
                price_data: {
                    currency,
                    unit_amount: taxCents,
                    product_data: { name: "Tax" },
                },
            });
        }

        const session = await stripe.checkout.sessions.create({
            ui_mode: "embedded",
            mode: "payment",
            line_items,
            billing_address_collection: "required",
            phone_number_collection: { enabled: true },
            invoice_creation: { enabled: false },

            // link to your order
            client_reference_id: order.order_number || String(order.id),
            metadata: {
                order_id: String(order.id),
                order_number: String(order.order_number || ""),
                source: "admin",
            },

            // optional: prefill email if admin entered it
            ...(order.customer_email ? { customer_email: String(order.customer_email) } : {}),

            // ✅ return to admin app, then we redirect to /orders/:id
            return_url: `${String(ADMIN_DOMAIN).replace(/\/$/, "")}/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
        });

        // attach session id to order (admin flow)
        db.prepare(`UPDATE orders SET stripe_checkout_session_id = ? WHERE id = ?`).run(session.id, order.id);

        return res.json({
            clientSecret: session.client_secret,
            sessionId: session.id,
            orderId: order.id,
            orderNumber: order.order_number,
        });
    } catch (err) {
        const status = err?.status || 500;
        res.status(status).json({
            error: err?.message || "Server error",
            details: err?.details || null,
        });
    }
}

// main endpoint (admin)
app.post("/api/admin/create-checkout-session", adminCreateCheckoutSessionHandler);
// alias (in case you really meant this exact path)
app.post("/admin/create-checkout-session", adminCreateCheckoutSessionHandler);

// Admin alias for session-status (admin app calls /api/admin/...)
app.get("/api/admin/session-status", sessionStatusHandler);

// =====================
// ADMIN (protected later)
// =====================
app.use("/api/admin/products", require("./routes/admin/productRoutes"));
app.use("/api/admin/brands", require("./routes/admin/brandRoutes"));
app.use("/api/admin/categories", require("./routes/admin/categoryRoutes"));
app.use("/api/admin/variants", require("./routes/admin/variantRoutes"));
app.use("/api/admin/keycards", require("./routes/admin/keycardRoutes"));
app.use("/api/search", require("./routes/admin/searchRoutes"));
app.use("/api/admin/orders", require("./routes/admin/adminOrdersRoutes"));

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
