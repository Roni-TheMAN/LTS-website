// /**
//  * backend/controllers/admin/adminOrdersController.js
//  *
//  * Admin Orders endpoints
//  * - GET    /api/admin/orders
//  * - GET    /api/admin/orders/:id
//  * - PUT    /api/admin/orders/:id
//  * - DELETE /api/admin/orders/:id
//  *
//  * Schema reference: `orders` + `order_items`.
//  *
//  * Rules:
//  * - Admin can update everything EXCEPT:
//  *   - anything in `order_items`
//  *   - totals/money fields (subtotal_cents, tax_cents, shipping_cents, total_cents, currency)
//  */
//
// const dbModule = require("../../db");
// const db = dbModule && dbModule.db ? dbModule.db : dbModule;
//
// // Stripe is optional: controller will still work without it
// let stripe = null;
// try {
//     const key = process.env.STRIPE_SECRET_KEY;
//     if (key) {
//         // eslint-disable-next-line global-require
//         stripe = require("stripe")(key);
//     }
// } catch (_) {
//     stripe = null;
// }
//
// const SETS = {
//     order_status: new Set(["placed", "cancelled", "completed"]),
//     payment_status: new Set(["pending", "paid", "refunded"]),
//     fulfillment_status: new Set(["unfulfilled", "fulfilled"]),
//     shipping_status: new Set(["pending", "shipped", "delivered"]),
//     source: new Set(["web", "phone", "manual"]),
//     payment_method: new Set(["stripe", "cash", "check", "invoice", "other"]),
// };
//
// function asInt(v, fallback, { min = 0, max = 1_000_000 } = {}) {
//     if (v === undefined || v === null || v === "") return fallback;
//     const n = Number(v);
//     if (!Number.isFinite(n)) return fallback;
//     const i = Math.floor(n);
//     if (i < min) return min;
//     if (i > max) return max;
//     return i;
// }
//
// function normalizeEnum(value, allowedSet, fieldName) {
//     if (value === null) return null;
//     if (value === undefined) return undefined;
//     const v = String(value);
//     if (!allowedSet.has(v)) {
//         const allowed = Array.from(allowedSet).join(", ");
//         const err = new Error(`Invalid ${fieldName}. Allowed: ${allowed}`);
//         err.status = 400;
//         throw err;
//     }
//     return v;
// }
//
// function safeSort(sortRaw) {
//     // sort="created_at:desc" | "paid_at:asc" | "total_cents:desc" etc
//     const raw = String(sortRaw || "created_at:desc");
//     const [field, dirRaw] = raw.split(":");
//     const dir = String(dirRaw || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
//
//     const map = {
//         created_at: "o.created_at",
//         updated_at: "o.updated_at",
//         paid_at: "o.paid_at",
//         total_cents: "o.total_cents",
//     };
//
//     return {
//         col: map[field] || map.created_at,
//         dir,
//     };
// }
//
// function buildWhere({ q, filters }, paramsOut) {
//     const where = [];
//
//     for (const [key, value] of Object.entries(filters)) {
//         if (value === undefined || value === null || value === "") continue;
//         where.push(`o.${key} = @${key}`);
//         paramsOut[key] = value;
//     }
//
//     const query = String(q || "").trim();
//     if (query) {
//         paramsOut.like = `%${query}%`;
//         const qId = Number.isInteger(Number(query)) ? Number(query) : null;
//         paramsOut.qId = qId;
//
//         where.push(`(
//       o.order_number LIKE @like OR
//       o.customer_email LIKE @like OR
//       o.customer_name LIKE @like OR
//       o.external_ref LIKE @like OR
//       o.stripe_checkout_session_id LIKE @like OR
//       o.stripe_payment_intent_id LIKE @like OR
//       o.stripe_customer_id LIKE @like OR
//       o.id = COALESCE(@qId, -1)
//     )`);
//     }
//
//     return where.length ? `WHERE ${where.join(" AND ")}` : "";
// }
//
// function errorToJson(err) {
//     return {
//         error: err?.message || "Request failed",
//     };
// }
//
// // Returns { receipt_url, hosted_invoice_url, invoice_pdf } (any can be null)
// async function fetchReceiptBundleForSession(sessionId) {
//     if (!stripe) return { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
//     if (!sessionId) return { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
//
//     const session = await stripe.checkout.sessions.retrieve(sessionId, {
//         expand: ["payment_intent.latest_charge", "invoice"],
//     });
//
//     let invoice_pdf = null;
//     let hosted_invoice_url = null;
//     let receipt_url = null;
//
//     // invoice (if enabled/created)
//     if (session.invoice) {
//         if (typeof session.invoice === "object") {
//             invoice_pdf = session.invoice.invoice_pdf || null;
//             hosted_invoice_url = session.invoice.hosted_invoice_url || null;
//         } else if (typeof session.invoice === "string") {
//             const inv = await stripe.invoices.retrieve(session.invoice);
//             invoice_pdf = inv.invoice_pdf || null;
//             hosted_invoice_url = inv.hosted_invoice_url || null;
//         }
//     }
//
//     // receipt_url lives on the Charge (via PaymentIntent.latest_charge)
//     const pi = session.payment_intent;
//     if (pi && typeof pi === "object") {
//         receipt_url = pi.latest_charge?.receipt_url || null;
//     } else if (typeof pi === "string") {
//         const charges = await stripe.charges.list({ payment_intent: pi, limit: 1 });
//         receipt_url = charges.data?.[0]?.receipt_url || null;
//     }
//
//     return { receipt_url, hosted_invoice_url, invoice_pdf };
// }
//
// async function listOrders(req, res) {
//     try {
//         const limit = asInt(req.query.limit, 25, { min: 1, max: 200 });
//         const offset = asInt(req.query.offset, 0, { min: 0, max: 10_000_000 });
//         const q = req.query.q ?? req.query.search ?? "";
//
//         const filters = {
//             order_status: req.query.order_status,
//             payment_status: req.query.payment_status,
//             fulfillment_status: req.query.fulfillment_status,
//             shipping_status: req.query.shipping_status,
//             source: req.query.source,
//             payment_method: req.query.payment_method,
//         };
//
//         // Validate enums when provided
//         filters.order_status = normalizeEnum(filters.order_status, SETS.order_status, "order_status");
//         filters.payment_status = normalizeEnum(filters.payment_status, SETS.payment_status, "payment_status");
//         filters.fulfillment_status = normalizeEnum(filters.fulfillment_status, SETS.fulfillment_status, "fulfillment_status");
//         filters.shipping_status = normalizeEnum(filters.shipping_status, SETS.shipping_status, "shipping_status");
//         filters.source = normalizeEnum(filters.source, SETS.source, "source");
//         filters.payment_method = normalizeEnum(filters.payment_method, SETS.payment_method, "payment_method");
//
//         const params = { limit, offset };
//         const whereSql = buildWhere({ q, filters }, params);
//         const sort = safeSort(req.query.sort);
//
//         const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${whereSql}`).get(params)?.n;
//
//         const rows = db
//             .prepare(
//                 `
//                     SELECT
//                         o.id,
//                         o.order_number,
//                         o.source,
//                         o.order_status,
//                         o.payment_status,
//                         o.fulfillment_status,
//                         o.shipping_status,
//                         o.payment_method,
//                         o.external_ref,
//                         o.currency,
//                         o.subtotal_cents,
//                         o.tax_cents,
//                         o.shipping_cents,
//                         o.total_cents,
//                         o.customer_email,
//                         o.customer_phone,
//                         o.customer_name,
//                         o.created_at,
//                         o.paid_at,
//                         o.updated_at
//                     FROM orders o
//                         ${whereSql}
//                     ORDER BY ${sort.col} ${sort.dir}, o.id DESC
//                     LIMIT @limit OFFSET @offset
//                 `
//             )
//             .all(params);
//
//         return res.json({
//             rows,
//             total: Number(total || 0),
//             limit,
//             offset,
//         });
//     } catch (err) {
//         const status = err.status || 500;
//         return res.status(status).json(errorToJson(err));
//     }
// }
//
// async function getOrder(req, res) {
//     try {
//         const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
//         if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });
//
//         const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
//         if (!order) return res.status(404).json({ error: "Order not found." });
//
//         const items = db
//             .prepare(
//                 `
//                     SELECT
//                         oi.*,
//                         p.name  AS product_name,
//                         v.name  AS variant_name,
//                         kd.name AS design_name,
//                         lt.name AS lock_tech_name
//                     FROM order_items oi
//                              LEFT JOIN products p         ON p.id  = oi.product_id
//                              LEFT JOIN variants v         ON v.id  = oi.variant_id
//                              LEFT JOIN keycard_designs kd ON kd.id = oi.design_id
//                              LEFT JOIN lock_tech lt       ON lt.id = oi.lock_tech_id
//                     WHERE oi.order_id = ?
//                     ORDER BY oi.id ASC
//                 `
//             )
//             .all(id);
//
//         // Attach Stripe receipt/invoice URLs (best effort; never fails the endpoint)
//         let receipt_bundle = { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
//         try {
//             receipt_bundle = await fetchReceiptBundleForSession(order.stripe_checkout_session_id);
//         } catch (_) {
//             receipt_bundle = { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
//         }
//
//         return res.json({ order, items, receipt_bundle });
//     } catch (err) {
//         const status = err.status || 500;
//         return res.status(status).json(errorToJson(err));
//     }
// }
//
// async function updateOrder(req, res) {
//     try {
//         const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
//         if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });
//
//         const existing = db.prepare(`SELECT id, paid_at FROM orders WHERE id = ?`).get(id);
//         if (!existing) return res.status(404).json({ error: "Order not found." });
//
//         const body = req.body && typeof req.body === "object" ? req.body : {};
//
//         const forbidden = new Set([
//             "currency",
//             "subtotal_cents",
//             "tax_cents",
//             "shipping_cents",
//             "total_cents",
//             "order_items",
//             "items",
//         ]);
//
//         const ignored_fields = Object.keys(body).filter((k) => forbidden.has(k));
//
//         const allowed = [
//             "order_number",
//             "source",
//             "order_status",
//             "payment_status",
//             "fulfillment_status",
//             "shipping_status",
//             "payment_method",
//             "external_ref",
//             "created_by",
//             "is_manual_pricing",
//             "customer_email",
//             "customer_phone",
//             "customer_name",
//             "ship_name",
//             "ship_line1",
//             "ship_line2",
//             "ship_city",
//             "ship_state",
//             "ship_postal_code",
//             "ship_country",
//             "bill_name",
//             "bill_line1",
//             "bill_line2",
//             "bill_city",
//             "bill_state",
//             "bill_postal_code",
//             "bill_country",
//             "stripe_checkout_session_id",
//             "stripe_payment_intent_id",
//             "stripe_customer_id",
//             "notes",
//             "metadata_json",
//             "paid_at", // allow backfill, optional
//         ];
//
//         const patch = {};
//         for (const key of allowed) {
//             if (Object.prototype.hasOwnProperty.call(body, key)) {
//                 patch[key] = body[key];
//             }
//         }
//
//         // Normalizations / validations
//         if (Object.prototype.hasOwnProperty.call(patch, "order_status")) {
//             patch.order_status = normalizeEnum(patch.order_status, SETS.order_status, "order_status");
//         }
//         if (Object.prototype.hasOwnProperty.call(patch, "payment_status")) {
//             patch.payment_status = normalizeEnum(patch.payment_status, SETS.payment_status, "payment_status");
//         }
//         if (Object.prototype.hasOwnProperty.call(patch, "fulfillment_status")) {
//             patch.fulfillment_status = normalizeEnum(
//                 patch.fulfillment_status,
//                 SETS.fulfillment_status,
//                 "fulfillment_status"
//             );
//         }
//         if (Object.prototype.hasOwnProperty.call(patch, "shipping_status")) {
//             patch.shipping_status = normalizeEnum(patch.shipping_status, SETS.shipping_status, "shipping_status");
//         }
//         if (Object.prototype.hasOwnProperty.call(patch, "source")) {
//             patch.source = normalizeEnum(patch.source, SETS.source, "source");
//         }
//         if (Object.prototype.hasOwnProperty.call(patch, "payment_method")) {
//             patch.payment_method = normalizeEnum(patch.payment_method, SETS.payment_method, "payment_method");
//         }
//
//         if (Object.prototype.hasOwnProperty.call(patch, "is_manual_pricing")) {
//             patch.is_manual_pricing = patch.is_manual_pricing ? 1 : 0;
//         }
//
//         // if payment_status flips to paid, set paid_at now if it's currently empty and caller didn't specify paid_at
//         const willSetPaidAtNow =
//             Object.prototype.hasOwnProperty.call(patch, "payment_status") &&
//             patch.payment_status === "paid" &&
//             !Object.prototype.hasOwnProperty.call(patch, "paid_at") &&
//             !existing.paid_at;
//
//         const keys = Object.keys(patch);
//         if (keys.length === 0 && ignored_fields.length === 0) {
//             return res.status(400).json({ error: "No updatable fields provided." });
//         }
//
//         if (keys.length > 0 || willSetPaidAtNow) {
//             const setClauses = [];
//             for (const k of keys) {
//                 setClauses.push(`${k} = @${k}`);
//             }
//             if (willSetPaidAtNow) {
//                 setClauses.push(`paid_at = datetime('now')`);
//             }
//
//             const stmt = db.prepare(`UPDATE orders SET ${setClauses.join(", ")} WHERE id = @id`);
//             stmt.run({ id, ...patch });
//         }
//
//         const updated = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
//         return res.json({ order: updated, ignored_fields });
//     } catch (err) {
//         const status = err.status || 500;
//         return res.status(status).json(errorToJson(err));
//     }
// }
//
// async function deleteOrder(req, res) {
//     try {
//         const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
//         if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });
//
//         const result = db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
//         if (!result || result.changes === 0) {
//             return res.status(404).json({ error: "Order not found." });
//         }
//         return res.json({ ok: true });
//     } catch (err) {
//         const status = err.status || 500;
//         return res.status(status).json(errorToJson(err));
//     }
// }
//
// async function createOrder(req, res) {
//     try {
//         const body = req.body && typeof req.body === "object" ? req.body : {};
//         const itemsIn = Array.isArray(body.items) ? body.items : [];
//         if (itemsIn.length === 0) return res.status(400).json({ error: "items is required." });
//
//         const source = normalizeEnum(body.source ?? "manual", SETS.source, "source");
//         const payment_method = normalizeEnum(body.payment_method ?? "invoice", SETS.payment_method, "payment_method");
//         const payment_status = normalizeEnum(body.payment_status ?? "pending", SETS.payment_status, "payment_status");
//
//         const shipping_cents = asInt(body.shipping_cents, 0, { min: 0, max: 10_000_000 });
//         const tax_cents = asInt(body.tax_cents, 0, { min: 0, max: 10_000_000 });
//
//         const customer = body.customer || {};
//         const shipping = body.shipping || {};
//         const billing = body.billing || {};
//
//         // ---- Build normalized order_items payload (server computes prices + totals) ----
//         let currency = null;
//         let is_manual_pricing = 0;
//
//         function pickCurrency(ccy) {
//             if (!ccy) return;
//             if (!currency) currency = String(ccy).toLowerCase();
//             if (currency !== String(ccy).toLowerCase()) {
//                 const err = new Error("Mixed currencies are not supported in one order.");
//                 err.status = 400;
//                 throw err;
//             }
//         }
//
//         function priceTierForVariant(variantId, qty) {
//             return db.prepare(
//                 `
//           SELECT *
//           FROM variant_prices
//           WHERE variant_id = ?
//             AND active = 1
//             AND min_qty <= ?
//             AND (max_qty IS NULL OR max_qty >= ?)
//           ORDER BY min_qty DESC
//           LIMIT 1
//         `
//             ).get(variantId, qty, qty);
//         }
//
//         function priceTierForKeycard(lockTechId, boxes) {
//             return db.prepare(
//                 `
//           SELECT *
//           FROM keycard_price_tiers
//           WHERE lock_tech_id = ?
//             AND active = 1
//             AND min_boxes <= ?
//             AND (max_boxes IS NULL OR max_boxes >= ?)
//           ORDER BY min_boxes DESC
//           LIMIT 1
//         `
//             ).get(lockTechId, boxes, boxes);
//         }
//
//         const normalized = [];
//
//         for (const raw of itemsIn) {
//             const kind = String(raw?.kind || "").toLowerCase();
//
//             if (kind === "variant") {
//                 const variant_id = asInt(raw?.variant_id, NaN, { min: 1, max: 2_147_483_647 });
//                 const qty = asInt(raw?.qty, NaN, { min: 1, max: 1_000_000 });
//                 if (!Number.isFinite(variant_id)) return res.status(400).json({ error: "Invalid variant_id." });
//                 if (!Number.isFinite(qty)) return res.status(400).json({ error: "Invalid qty." });
//
//                 const v = db.prepare(
//                     `
//             SELECT v.id, v.product_id, v.sku, v.name AS variant_name, p.name AS product_name
//             FROM variants v
//             JOIN products p ON p.id = v.product_id
//             WHERE v.id = ? AND v.active = 1
//           `
//                 ).get(variant_id);
//
//                 if (!v) return res.status(400).json({ error: `Variant not found/active: ${variant_id}` });
//
//                 let unit_amount_cents;
//                 let price_source = "catalog";
//
//                 if (raw?.override_unit_amount_cents !== undefined && raw?.override_unit_amount_cents !== null) {
//                     unit_amount_cents = asInt(raw.override_unit_amount_cents, NaN, { min: 0, max: 1_000_000_000 });
//                     if (!Number.isFinite(unit_amount_cents)) return res.status(400).json({ error: "Invalid override_unit_amount_cents." });
//                     price_source = "override";
//                     is_manual_pricing = 1;
//                     pickCurrency(raw.currency || "usd");
//                 } else {
//                     const tier = priceTierForVariant(variant_id, qty);
//                     if (!tier) return res.status(400).json({ error: `No active tier price for variant ${variant_id} qty ${qty}.` });
//                     unit_amount_cents = Number(tier.unit_amount_cents);
//                     pickCurrency(tier.currency || "usd");
//                 }
//
//                 const line_total_cents = unit_amount_cents * qty;
//
//                 normalized.push({
//                     item_type: "regular",
//                     product_id: Number(v.product_id),
//                     variant_id: Number(v.id),
//                     design_id: null,
//                     lock_tech_id: null,
//                     box_size: 200,
//                     boxes: null,
//                     price_source,
//                     stripe_price_id: null,
//                     stripe_product_id: null,
//                     currency: currency || "usd",
//                     unit_amount_cents,
//                     quantity: qty,
//                     line_total_cents,
//                     description: `${v.product_name} — ${v.variant_name}${v.sku ? ` (${v.sku})` : ""}`,
//                     metadata_json: JSON.stringify({ kind: "variant", sku: v.sku || null }),
//                 });
//             } else if (kind === "custom") {
//                 const name = String(raw?.name || "").trim();
//                 const desc = raw?.description == null ? "" : String(raw.description).trim();
//                 const qty = asInt(raw?.qty, NaN, { min: 1, max: 1_000_000 });
//                 const unit_amount_cents = asInt(raw?.unit_amount_cents, NaN, { min: 0, max: 1_000_000_000 });
//                 if (!name) return res.status(400).json({ error: "Custom item name is required." });
//                 if (!Number.isFinite(qty)) return res.status(400).json({ error: "Invalid custom qty." });
//                 if (!Number.isFinite(unit_amount_cents)) return res.status(400).json({ error: "Invalid custom unit_amount_cents." });
//
//                 is_manual_pricing = 1;
//                 pickCurrency(raw.currency || "usd");
//
//                 const line_total_cents = unit_amount_cents * qty;
//
//                 normalized.push({
//                     item_type: "regular",
//                     product_id: null,
//                     variant_id: null,
//                     design_id: null,
//                     lock_tech_id: null,
//                     box_size: 200,
//                     boxes: null,
//                     price_source: "custom",
//                     stripe_price_id: null,
//                     stripe_product_id: null,
//                     currency: currency || "usd",
//                     unit_amount_cents,
//                     quantity: qty,
//                     line_total_cents,
//                     description: desc ? `${name} — ${desc}` : name,
//                     metadata_json: JSON.stringify({ kind: "custom", name, description: desc || null }),
//                 });
//             } else if (kind === "keycard") {
//                 const lock_tech_id = asInt(raw?.lock_tech_id, NaN, { min: 1, max: 2_147_483_647 });
//                 const boxes = asInt(raw?.boxes, NaN, { min: 1, max: 1_000_000 });
//                 const design_id = raw?.design_id == null ? null : asInt(raw.design_id, NaN, { min: 1, max: 2_147_483_647 });
//
//                 if (!Number.isFinite(lock_tech_id)) return res.status(400).json({ error: "Invalid lock_tech_id." });
//                 if (!Number.isFinite(boxes)) return res.status(400).json({ error: "Invalid boxes." });
//                 if (raw?.design_id != null && !Number.isFinite(design_id)) return res.status(400).json({ error: "Invalid design_id." });
//
//                 const tier = priceTierForKeycard(lock_tech_id, boxes);
//                 if (!tier) return res.status(400).json({ error: `No active keycard tier for lock_tech ${lock_tech_id} boxes ${boxes}.` });
//
//                 pickCurrency(tier.currency || "usd");
//
//                 const unit_amount_cents = Number(tier.price_per_box_cents);
//                 const quantity = boxes;
//                 const line_total_cents = unit_amount_cents * quantity;
//
//                 normalized.push({
//                     item_type: "keycard",
//                     product_id: null,
//                     variant_id: null,
//                     design_id,
//                     lock_tech_id,
//                     box_size: 200,
//                     boxes,
//                     price_source: "catalog",
//                     stripe_price_id: null,
//                     stripe_product_id: null,
//                     currency: currency || "usd",
//                     unit_amount_cents,
//                     quantity,
//                     line_total_cents,
//                     description: `Keycards (${boxes} boxes)`,
//                     metadata_json: JSON.stringify({ kind: "keycard" }),
//                 });
//             } else {
//                 return res.status(400).json({ error: `Unknown item kind: ${kind}` });
//             }
//         }
//
//         currency = currency || "usd";
//
//         const subtotal_cents = normalized.reduce((sum, it) => sum + Number(it.line_total_cents || 0), 0);
//         const total_cents = subtotal_cents + tax_cents + shipping_cents;
//
//         const tx = db.transaction(() => {
//             // Insert order (order_number set after id known)
//             const info = db.prepare(
//                 `
//           INSERT INTO orders (
//             order_number,
//             source,
//             order_status,
//             payment_status,
//             fulfillment_status,
//             shipping_status,
//             payment_method,
//             external_ref,
//             created_by,
//             is_manual_pricing,
//             currency,
//             subtotal_cents,
//             tax_cents,
//             shipping_cents,
//             total_cents,
//             customer_email,
//             customer_phone,
//             customer_name,
//             ship_name,
//             ship_line1,
//             ship_line2,
//             ship_city,
//             ship_state,
//             ship_postal_code,
//             ship_country,
//             bill_name,
//             bill_line1,
//             bill_line2,
//             bill_city,
//             bill_state,
//             bill_postal_code,
//             bill_country,
//             notes,
//             metadata_json,
//             paid_at
//           ) VALUES (
//             NULL,
//             @source,
//             'placed',
//             @payment_status,
//             'unfulfilled',
//             'pending',
//             @payment_method,
//             @external_ref,
//             @created_by,
//             @is_manual_pricing,
//             @currency,
//             @subtotal_cents,
//             @tax_cents,
//             @shipping_cents,
//             @total_cents,
//             @customer_email,
//             @customer_phone,
//             @customer_name,
//             @ship_name,
//             @ship_line1,
//             @ship_line2,
//             @ship_city,
//             @ship_state,
//             @ship_postal_code,
//             @ship_country,
//             @bill_name,
//             @bill_line1,
//             @bill_line2,
//             @bill_city,
//             @bill_state,
//             @bill_postal_code,
//             @bill_country,
//             @notes,
//             @metadata_json,
//             CASE WHEN @payment_status = 'paid' THEN datetime('now') ELSE NULL END
//           )
//         `
//             ).run({
//                 source,
//                 payment_status,
//                 payment_method,
//                 external_ref: body.external_ref || null,
//                 created_by: body.created_by || null,
//                 is_manual_pricing,
//                 currency,
//                 subtotal_cents,
//                 tax_cents,
//                 shipping_cents,
//                 total_cents,
//                 customer_email: customer.email || null,
//                 customer_phone: customer.phone || null,
//                 customer_name: customer.name || null,
//                 ship_name: shipping.name || null,
//                 ship_line1: shipping.line1 || null,
//                 ship_line2: shipping.line2 || null,
//                 ship_city: shipping.city || null,
//                 ship_state: shipping.state || null,
//                 ship_postal_code: shipping.postal_code || null,
//                 ship_country: shipping.country || null,
//                 bill_name: billing.name || null,
//                 bill_line1: billing.line1 || null,
//                 bill_line2: billing.line2 || null,
//                 bill_city: billing.city || null,
//                 bill_state: billing.state || null,
//                 bill_postal_code: billing.postal_code || null,
//                 bill_country: billing.country || null,
//                 notes: body.notes || null,
//                 metadata_json: body.metadata_json ? String(body.metadata_json) : null,
//             });
//
//             const orderId = Number(info.lastInsertRowid);
//
//             const year = new Date().getFullYear();
//             const order_number = `LTS-${year}-${String(orderId).padStart(6, "0")}`;
//             db.prepare(`UPDATE orders SET order_number = ? WHERE id = ?`).run(order_number, orderId);
//
//             const insItem = db.prepare(
//                 `
//           INSERT INTO order_items (
//             order_id,
//             item_type,
//             product_id,
//             variant_id,
//             design_id,
//             lock_tech_id,
//             box_size,
//             boxes,
//             price_source,
//             stripe_price_id,
//             stripe_product_id,
//             currency,
//             unit_amount_cents,
//             quantity,
//             line_total_cents,
//             description,
//             metadata_json
//           ) VALUES (
//             @order_id,
//             @item_type,
//             @product_id,
//             @variant_id,
//             @design_id,
//             @lock_tech_id,
//             @box_size,
//             @boxes,
//             @price_source,
//             @stripe_price_id,
//             @stripe_product_id,
//             @currency,
//             @unit_amount_cents,
//             @quantity,
//             @line_total_cents,
//             @description,
//             @metadata_json
//           )
//         `
//             );
//
//             for (const it of normalized) insItem.run({ ...it, order_id: orderId });
//
//             const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
//             const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(orderId);
//
//             return { order, items };
//         });
//
//         const created = tx();
//         return res.status(201).json(created);
//     } catch (err) {
//         const status = err.status || 500;
//         return res.status(status).json(errorToJson(err));
//     }
// }
//
//
//
// module.exports = {
//     listOrders,
//     getOrder,
//     updateOrder,
//     deleteOrder,
//     createOrder,
// };


/**
 * backend/controllers/admin/adminOrdersController.js
 *
 * Admin Orders endpoints
 * - GET    /api/admin/orders
 * - GET    /api/admin/orders/:id
 * - PUT    /api/admin/orders/:id
 * - DELETE /api/admin/orders/:id
 *
 * Schema reference: `orders` + `order_items`.
 *
 * Rules:
 * - Admin can update everything EXCEPT:
 *   - anything in `order_items`
 *   - totals/money fields (subtotal_cents, tax_cents, shipping_cents, total_cents, currency)
 */

const dbModule = require("../../db");
const db = dbModule && dbModule.db ? dbModule.db : dbModule;

// Stripe is optional: controller will still work without it
let stripe = null;
try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
        // eslint-disable-next-line global-require
        stripe = require("stripe")(key);
    }
} catch (_) {
    stripe = null;
}

const SETS = {
    order_status: new Set(["placed", "cancelled", "completed"]),
    payment_status: new Set(["pending", "paid", "refunded"]),
    fulfillment_status: new Set(["unfulfilled", "fulfilled"]),
    shipping_status: new Set(["pending", "shipped", "delivered"]),
    source: new Set(["web", "phone", "manual"]),
    payment_method: new Set(["stripe", "cash", "check", "invoice", "other"]),
};

function asInt(v, fallback, { min = 0, max = 1_000_000 } = {}) {
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    if (i < min) return min;
    if (i > max) return max;
    return i;
}

function normalizeEnum(value, allowedSet, fieldName) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    const v = String(value);
    if (!allowedSet.has(v)) {
        const allowed = Array.from(allowedSet).join(", ");
        const err = new Error(`Invalid ${fieldName}. Allowed: ${allowed}`);
        err.status = 400;
        throw err;
    }
    return v;
}

function safeSort(sortRaw) {
    // sort="created_at:desc" | "paid_at:asc" | "total_cents:desc" etc
    const raw = String(sortRaw || "created_at:desc");
    const [field, dirRaw] = raw.split(":");
    const dir = String(dirRaw || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const map = {
        created_at: "o.created_at",
        updated_at: "o.updated_at",
        paid_at: "o.paid_at",
        total_cents: "o.total_cents",
    };

    return {
        col: map[field] || map.created_at,
        dir,
    };
}

function buildWhere({ q, filters }, paramsOut) {
    const where = [];

    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === "") continue;
        where.push(`o.${key} = @${key}`);
        paramsOut[key] = value;
    }

    const query = String(q || "").trim();
    if (query) {
        paramsOut.like = `%${query}%`;
        const qId = Number.isInteger(Number(query)) ? Number(query) : null;
        paramsOut.qId = qId;

        where.push(`(
      o.order_number LIKE @like OR
      o.customer_email LIKE @like OR
      o.customer_name LIKE @like OR
      o.external_ref LIKE @like OR
      o.stripe_checkout_session_id LIKE @like OR
      o.stripe_payment_intent_id LIKE @like OR
      o.stripe_customer_id LIKE @like OR
      o.id = COALESCE(@qId, -1)
    )`);
    }

    return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

function errorToJson(err) {
    return {
        error: err?.message || "Request failed",
    };
}

// Returns { receipt_url, hosted_invoice_url, invoice_pdf } (any can be null)
async function fetchReceiptBundleForSession(sessionId) {
    if (!stripe) return { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
    if (!sessionId) return { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };

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

async function listOrders(req, res) {
    try {
        const limit = asInt(req.query.limit, 25, { min: 1, max: 200 });
        const offset = asInt(req.query.offset, 0, { min: 0, max: 10_000_000 });
        const q = req.query.q ?? req.query.search ?? "";

        const filters = {
            order_status: req.query.order_status,
            payment_status: req.query.payment_status,
            fulfillment_status: req.query.fulfillment_status,
            shipping_status: req.query.shipping_status,
            source: req.query.source,
            payment_method: req.query.payment_method,
        };

        // Validate enums when provided
        filters.order_status = normalizeEnum(filters.order_status, SETS.order_status, "order_status");
        filters.payment_status = normalizeEnum(filters.payment_status, SETS.payment_status, "payment_status");
        filters.fulfillment_status = normalizeEnum(filters.fulfillment_status, SETS.fulfillment_status, "fulfillment_status");
        filters.shipping_status = normalizeEnum(filters.shipping_status, SETS.shipping_status, "shipping_status");
        filters.source = normalizeEnum(filters.source, SETS.source, "source");
        filters.payment_method = normalizeEnum(filters.payment_method, SETS.payment_method, "payment_method");

        const params = { limit, offset };
        const whereSql = buildWhere({ q, filters }, params);
        const sort = safeSort(req.query.sort);

        const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${whereSql}`).get(params)?.n;

        const rows = db
            .prepare(
                `
                    SELECT
                        o.id,
                        o.order_number,
                        o.source,
                        o.order_status,
                        o.payment_status,
                        o.fulfillment_status,
                        o.shipping_status,
                        o.payment_method,
                        o.external_ref,
                        o.currency,
                        o.subtotal_cents,
                        o.tax_cents,
                        o.shipping_cents,
                        o.total_cents,
                        o.customer_email,
                        o.customer_phone,
                        o.customer_name,
                        o.created_at,
                        o.paid_at,
                        o.updated_at
                    FROM orders o
                        ${whereSql}
                    ORDER BY ${sort.col} ${sort.dir}, o.id DESC
                    LIMIT @limit OFFSET @offset
                `
            )
            .all(params);

        return res.json({
            rows,
            total: Number(total || 0),
            limit,
            offset,
        });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json(errorToJson(err));
    }
}

async function getOrder(req, res) {
    try {
        const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
        if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });

        const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
        if (!order) return res.status(404).json({ error: "Order not found." });

        const items = db
            .prepare(
                `
                    SELECT
                        oi.*,
                        p.name  AS product_name,
                        v.name  AS variant_name,
                        kd.name AS design_name,
                        lt.name AS lock_tech_name,
                        img_p.url      AS product_image_url,
                        img_p.alt_text AS product_image_alt,
                        img_d.url      AS design_image_url,
                        img_d.alt_text AS design_image_alt
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
            .all(id);

        // Attach Stripe receipt/invoice URLs (best effort; never fails the endpoint)
        let receipt_bundle = { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
        try {
            receipt_bundle = await fetchReceiptBundleForSession(order.stripe_checkout_session_id);
        } catch (_) {
            receipt_bundle = { receipt_url: null, hosted_invoice_url: null, invoice_pdf: null };
        }

        return res.json({ order, items, receipt_bundle });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json(errorToJson(err));
    }
}

async function updateOrder(req, res) {
    try {
        const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
        if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });

        const existing = db.prepare(`SELECT id, paid_at FROM orders WHERE id = ?`).get(id);
        if (!existing) return res.status(404).json({ error: "Order not found." });

        const body = req.body && typeof req.body === "object" ? req.body : {};

        const forbidden = new Set([
            "currency",
            "subtotal_cents",
            "tax_cents",
            "shipping_cents",
            "total_cents",
            "order_items",
            "items",
        ]);

        const ignored_fields = Object.keys(body).filter((k) => forbidden.has(k));

        const allowed = [
            "order_number",
            "source",
            "order_status",
            "payment_status",
            "fulfillment_status",
            "shipping_status",
            "payment_method",
            "external_ref",
            "created_by",
            "is_manual_pricing",
            "customer_email",
            "customer_phone",
            "customer_name",
            "ship_name",
            "ship_line1",
            "ship_line2",
            "ship_city",
            "ship_state",
            "ship_postal_code",
            "ship_country",
            "bill_name",
            "bill_line1",
            "bill_line2",
            "bill_city",
            "bill_state",
            "bill_postal_code",
            "bill_country",
            "stripe_checkout_session_id",
            "stripe_payment_intent_id",
            "stripe_customer_id",
            "notes",
            "metadata_json",
            "paid_at", // allow backfill, optional
        ];

        const patch = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                patch[key] = body[key];
            }
        }

        // Normalizations / validations
        if (Object.prototype.hasOwnProperty.call(patch, "order_status")) {
            patch.order_status = normalizeEnum(patch.order_status, SETS.order_status, "order_status");
        }
        if (Object.prototype.hasOwnProperty.call(patch, "payment_status")) {
            patch.payment_status = normalizeEnum(patch.payment_status, SETS.payment_status, "payment_status");
        }
        if (Object.prototype.hasOwnProperty.call(patch, "fulfillment_status")) {
            patch.fulfillment_status = normalizeEnum(
                patch.fulfillment_status,
                SETS.fulfillment_status,
                "fulfillment_status"
            );
        }
        if (Object.prototype.hasOwnProperty.call(patch, "shipping_status")) {
            patch.shipping_status = normalizeEnum(patch.shipping_status, SETS.shipping_status, "shipping_status");
        }
        if (Object.prototype.hasOwnProperty.call(patch, "source")) {
            patch.source = normalizeEnum(patch.source, SETS.source, "source");
        }
        if (Object.prototype.hasOwnProperty.call(patch, "payment_method")) {
            patch.payment_method = normalizeEnum(patch.payment_method, SETS.payment_method, "payment_method");
        }

        if (Object.prototype.hasOwnProperty.call(patch, "is_manual_pricing")) {
            patch.is_manual_pricing = patch.is_manual_pricing ? 1 : 0;
        }

        // if payment_status flips to paid, set paid_at now if it's currently empty and caller didn't specify paid_at
        const willSetPaidAtNow =
            Object.prototype.hasOwnProperty.call(patch, "payment_status") &&
            patch.payment_status === "paid" &&
            !Object.prototype.hasOwnProperty.call(patch, "paid_at") &&
            !existing.paid_at;

        const keys = Object.keys(patch);
        if (keys.length === 0 && ignored_fields.length === 0) {
            return res.status(400).json({ error: "No updatable fields provided." });
        }

        if (keys.length > 0 || willSetPaidAtNow) {
            const setClauses = [];
            for (const k of keys) {
                setClauses.push(`${k} = @${k}`);
            }
            if (willSetPaidAtNow) {
                setClauses.push(`paid_at = datetime('now')`);
            }

            const stmt = db.prepare(`UPDATE orders SET ${setClauses.join(", ")} WHERE id = @id`);
            stmt.run({ id, ...patch });
        }

        const updated = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
        return res.json({ order: updated, ignored_fields });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json(errorToJson(err));
    }
}

async function deleteOrder(req, res) {
    try {
        const id = asInt(req.params.id, NaN, { min: 1, max: 2_147_483_647 });
        if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid order id." });

        const result = db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
        if (!result || result.changes === 0) {
            return res.status(404).json({ error: "Order not found." });
        }
        return res.json({ ok: true });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json(errorToJson(err));
    }
}

async function createOrder(req, res) {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const itemsIn = Array.isArray(body.items) ? body.items : [];
        if (itemsIn.length === 0) return res.status(400).json({ error: "items is required." });

        const source = normalizeEnum(body.source ?? "manual", SETS.source, "source");
        const payment_method = normalizeEnum(body.payment_method ?? "invoice", SETS.payment_method, "payment_method");
        const payment_status = normalizeEnum(body.payment_status ?? "pending", SETS.payment_status, "payment_status");

        const shipping_cents = asInt(body.shipping_cents, 0, { min: 0, max: 10_000_000 });
        const tax_cents = asInt(body.tax_cents, 0, { min: 0, max: 10_000_000 });

        const customer = body.customer || {};
        const shipping = body.shipping || {};
        const billing = body.billing || {};

        // ---- Build normalized order_items payload (server computes prices + totals) ----
        let currency = null;
        let is_manual_pricing = 0;

        function pickCurrency(ccy) {
            if (!ccy) return;
            if (!currency) currency = String(ccy).toLowerCase();
            if (currency !== String(ccy).toLowerCase()) {
                const err = new Error("Mixed currencies are not supported in one order.");
                err.status = 400;
                throw err;
            }
        }

        function priceTierForVariant(variantId, qty) {
            return db.prepare(
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
            ).get(variantId, qty, qty);
        }

        function priceTierForKeycard(lockTechId, boxes) {
            return db.prepare(
                `
          SELECT *
          FROM keycard_price_tiers
          WHERE lock_tech_id = ?
            AND active = 1
            AND min_boxes <= ?
            AND (max_boxes IS NULL OR max_boxes >= ?)
          ORDER BY min_boxes DESC
          LIMIT 1
        `
            ).get(lockTechId, boxes, boxes);
        }

        const normalized = [];

        for (const raw of itemsIn) {
            const kind = String(raw?.kind || "").toLowerCase();

            if (kind === "variant") {
                const variant_id = asInt(raw?.variant_id, NaN, { min: 1, max: 2_147_483_647 });
                const qty = asInt(raw?.qty, NaN, { min: 1, max: 1_000_000 });
                if (!Number.isFinite(variant_id)) return res.status(400).json({ error: "Invalid variant_id." });
                if (!Number.isFinite(qty)) return res.status(400).json({ error: "Invalid qty." });

                const v = db.prepare(
                    `
            SELECT v.id, v.product_id, v.sku, v.name AS variant_name, p.name AS product_name
            FROM variants v
            JOIN products p ON p.id = v.product_id
            WHERE v.id = ? AND v.active = 1
          `
                ).get(variant_id);

                if (!v) return res.status(400).json({ error: `Variant not found/active: ${variant_id}` });

                let unit_amount_cents;
                let price_source = "catalog";

                if (raw?.override_unit_amount_cents !== undefined && raw?.override_unit_amount_cents !== null) {
                    unit_amount_cents = asInt(raw.override_unit_amount_cents, NaN, { min: 0, max: 1_000_000_000 });
                    if (!Number.isFinite(unit_amount_cents)) return res.status(400).json({ error: "Invalid override_unit_amount_cents." });
                    price_source = "override";
                    is_manual_pricing = 1;
                    pickCurrency(raw.currency || "usd");
                } else {
                    const tier = priceTierForVariant(variant_id, qty);
                    if (!tier) return res.status(400).json({ error: `No active tier price for variant ${variant_id} qty ${qty}.` });
                    unit_amount_cents = Number(tier.unit_amount_cents);
                    pickCurrency(tier.currency || "usd");
                }

                const line_total_cents = unit_amount_cents * qty;

                normalized.push({
                    item_type: "regular",
                    product_id: Number(v.product_id),
                    variant_id: Number(v.id),
                    design_id: null,
                    lock_tech_id: null,
                    box_size: 200,
                    boxes: null,
                    price_source,
                    stripe_price_id: null,
                    stripe_product_id: null,
                    currency: currency || "usd",
                    unit_amount_cents,
                    quantity: qty,
                    line_total_cents,
                    description: `${v.product_name} — ${v.variant_name}${v.sku ? ` (${v.sku})` : ""}`,
                    metadata_json: JSON.stringify({ kind: "variant", sku: v.sku || null }),
                });
            } else if (kind === "custom") {
                const name = String(raw?.name || "").trim();
                const desc = raw?.description == null ? "" : String(raw.description).trim();
                const qty = asInt(raw?.qty, NaN, { min: 1, max: 1_000_000 });
                const unit_amount_cents = asInt(raw?.unit_amount_cents, NaN, { min: 0, max: 1_000_000_000 });
                if (!name) return res.status(400).json({ error: "Custom item name is required." });
                if (!Number.isFinite(qty)) return res.status(400).json({ error: "Invalid custom qty." });
                if (!Number.isFinite(unit_amount_cents)) return res.status(400).json({ error: "Invalid custom unit_amount_cents." });

                is_manual_pricing = 1;
                pickCurrency(raw.currency || "usd");

                const line_total_cents = unit_amount_cents * qty;

                normalized.push({
                    item_type: "regular",
                    product_id: null,
                    variant_id: null,
                    design_id: null,
                    lock_tech_id: null,
                    box_size: 200,
                    boxes: null,
                    price_source: "custom",
                    stripe_price_id: null,
                    stripe_product_id: null,
                    currency: currency || "usd",
                    unit_amount_cents,
                    quantity: qty,
                    line_total_cents,
                    description: desc ? `${name} — ${desc}` : name,
                    metadata_json: JSON.stringify({ kind: "custom", name, description: desc || null }),
                });
            } else if (kind === "keycard") {
                const lock_tech_id = asInt(raw?.lock_tech_id, NaN, { min: 1, max: 2_147_483_647 });
                const boxes = asInt(raw?.boxes, NaN, { min: 1, max: 1_000_000 });
                const design_id = raw?.design_id == null ? null : asInt(raw.design_id, NaN, { min: 1, max: 2_147_483_647 });

                if (!Number.isFinite(lock_tech_id)) return res.status(400).json({ error: "Invalid lock_tech_id." });
                if (!Number.isFinite(boxes)) return res.status(400).json({ error: "Invalid boxes." });
                if (raw?.design_id != null && !Number.isFinite(design_id)) return res.status(400).json({ error: "Invalid design_id." });

                const tier = priceTierForKeycard(lock_tech_id, boxes);
                if (!tier) return res.status(400).json({ error: `No active keycard tier for lock_tech ${lock_tech_id} boxes ${boxes}.` });

                pickCurrency(tier.currency || "usd");

                const unit_amount_cents = Number(tier.price_per_box_cents);
                const quantity = boxes;
                const line_total_cents = unit_amount_cents * quantity;

                normalized.push({
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
                    currency: currency || "usd",
                    unit_amount_cents,
                    quantity,
                    line_total_cents,
                    description: `Keycards (${boxes} boxes)`,
                    metadata_json: JSON.stringify({ kind: "keycard" }),
                });
            } else {
                return res.status(400).json({ error: `Unknown item kind: ${kind}` });
            }
        }

        currency = currency || "usd";

        const subtotal_cents = normalized.reduce((sum, it) => sum + Number(it.line_total_cents || 0), 0);
        const total_cents = subtotal_cents + tax_cents + shipping_cents;

        const tx = db.transaction(() => {
            // Insert order (order_number set after id known)
            const info = db.prepare(
                `
          INSERT INTO orders (
            order_number,
            source,
            order_status,
            payment_status,
            fulfillment_status,
            shipping_status,
            payment_method,
            external_ref,
            created_by,
            is_manual_pricing,
            currency,
            subtotal_cents,
            tax_cents,
            shipping_cents,
            total_cents,
            customer_email,
            customer_phone,
            customer_name,
            ship_name,
            ship_line1,
            ship_line2,
            ship_city,
            ship_state,
            ship_postal_code,
            ship_country,
            bill_name,
            bill_line1,
            bill_line2,
            bill_city,
            bill_state,
            bill_postal_code,
            bill_country,
            notes,
            metadata_json,
            paid_at
          ) VALUES (
            NULL,
            @source,
            'placed',
            @payment_status,
            'unfulfilled',
            'pending',
            @payment_method,
            @external_ref,
            @created_by,
            @is_manual_pricing,
            @currency,
            @subtotal_cents,
            @tax_cents,
            @shipping_cents,
            @total_cents,
            @customer_email,
            @customer_phone,
            @customer_name,
            @ship_name,
            @ship_line1,
            @ship_line2,
            @ship_city,
            @ship_state,
            @ship_postal_code,
            @ship_country,
            @bill_name,
            @bill_line1,
            @bill_line2,
            @bill_city,
            @bill_state,
            @bill_postal_code,
            @bill_country,
            @notes,
            @metadata_json,
            CASE WHEN @payment_status = 'paid' THEN datetime('now') ELSE NULL END
          )
        `
            ).run({
                source,
                payment_status,
                payment_method,
                external_ref: body.external_ref || null,
                created_by: body.created_by || null,
                is_manual_pricing,
                currency,
                subtotal_cents,
                tax_cents,
                shipping_cents,
                total_cents,
                customer_email: customer.email || null,
                customer_phone: customer.phone || null,
                customer_name: customer.name || null,
                ship_name: shipping.name || null,
                ship_line1: shipping.line1 || null,
                ship_line2: shipping.line2 || null,
                ship_city: shipping.city || null,
                ship_state: shipping.state || null,
                ship_postal_code: shipping.postal_code || null,
                ship_country: shipping.country || null,
                bill_name: billing.name || null,
                bill_line1: billing.line1 || null,
                bill_line2: billing.line2 || null,
                bill_city: billing.city || null,
                bill_state: billing.state || null,
                bill_postal_code: billing.postal_code || null,
                bill_country: billing.country || null,
                notes: body.notes || null,
                metadata_json: body.metadata_json ? String(body.metadata_json) : null,
            });

            const orderId = Number(info.lastInsertRowid);

            const year = new Date().getFullYear();
            const order_number = `LTS-${year}-${String(orderId).padStart(6, "0")}`;
            db.prepare(`UPDATE orders SET order_number = ? WHERE id = ?`).run(order_number, orderId);

            const insItem = db.prepare(
                `
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
          ) VALUES (
            @order_id,
            @item_type,
            @product_id,
            @variant_id,
            @design_id,
            @lock_tech_id,
            @box_size,
            @boxes,
            @price_source,
            @stripe_price_id,
            @stripe_product_id,
            @currency,
            @unit_amount_cents,
            @quantity,
            @line_total_cents,
            @description,
            @metadata_json
          )
        `
            );

            for (const it of normalized) insItem.run({ ...it, order_id: orderId });

            const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
            const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(orderId);

            return { order, items };
        });

        const created = tx();
        return res.status(201).json(created);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json(errorToJson(err));
    }
}



module.exports = {
    listOrders,
    getOrder,
    updateOrder,
    deleteOrder,
    createOrder,
};
