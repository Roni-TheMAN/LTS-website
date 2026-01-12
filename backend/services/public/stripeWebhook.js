// // backend/services/public/stripeWebhook.js
// // Verifies Stripe signature (raw body) + updates orders table
//
// function safeJsonParse(s) {
//     if (!s) return {};
//     try {
//         return JSON.parse(s);
//     } catch {
//         return {};
//     }
// }
//
// function pickAddr(a) {
//     if (!a) return {};
//     return {
//         line1: a.line1 || null,
//         line2: a.line2 || null,
//         city: a.city || null,
//         state: a.state || null,
//         postal_code: a.postal_code || null,
//         country: a.country || null,
//     };
// }
//
// function getOrderIdForSession(db, session) {
//     const metaOrderId = session?.metadata?.order_id;
//     if (metaOrderId) {
//         const row = db.prepare(`SELECT id FROM orders WHERE id = ?`).get(Number(metaOrderId));
//         if (row?.id) return row.id;
//     }
//
//     // fallback 1: match by stored session id (best if you attached it after session creation)
//     const bySession = db
//         .prepare(`SELECT id FROM orders WHERE stripe_checkout_session_id = ?`)
//         .get(session.id);
//     if (bySession?.id) return bySession.id;
//
//     // fallback 2: match by order_number from metadata or client_reference_id
//     const orderNumber = session?.metadata?.order_number || session?.client_reference_id;
//     if (orderNumber) {
//         const byNum = db.prepare(`SELECT id FROM orders WHERE order_number = ?`).get(orderNumber);
//         if (byNum?.id) return byNum.id;
//     }
//
//     return null;
// }
//
// module.exports = ({ db, stripe }) => {
//     const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
//     if (!endpointSecret) {
//         throw new Error("Missing STRIPE_WEBHOOK_SECRET in env.");
//     }
//
//     const insEvent = db.prepare(`
//     INSERT INTO stripe_events (event_id, event_type, payload_json)
//     VALUES (?, ?, ?)
//   `);
//
//     const markProcessed = db.prepare(`
//     UPDATE stripe_events
//     SET processed_at = datetime('now')
//     WHERE event_id = ?
//   `);
//
//     const getOrderMeta = db.prepare(`SELECT metadata_json FROM orders WHERE id = ?`);
//
//     const updateOrder = db.prepare(`
//     UPDATE orders SET
//       stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
//       stripe_payment_intent_id   = COALESCE(?, stripe_payment_intent_id),
//       stripe_customer_id         = COALESCE(?, stripe_customer_id),
//
//       currency       = COALESCE(?, currency),
//       subtotal_cents = COALESCE(?, subtotal_cents),
//       tax_cents      = COALESCE(?, tax_cents),
//       shipping_cents = COALESCE(?, shipping_cents),
//       total_cents    = COALESCE(?, total_cents),
//
//       customer_email = COALESCE(?, customer_email),
//       customer_phone = COALESCE(?, customer_phone),
//       customer_name  = COALESCE(?, customer_name),
//
//       ship_name        = COALESCE(?, ship_name),
//       ship_line1       = COALESCE(?, ship_line1),
//       ship_line2       = COALESCE(?, ship_line2),
//       ship_city        = COALESCE(?, ship_city),
//       ship_state       = COALESCE(?, ship_state),
//       ship_postal_code = COALESCE(?, ship_postal_code),
//       ship_country     = COALESCE(?, ship_country),
//
//       bill_name        = COALESCE(?, bill_name),
//       bill_line1       = COALESCE(?, bill_line1),
//       bill_line2       = COALESCE(?, bill_line2),
//       bill_city        = COALESCE(?, bill_city),
//       bill_state       = COALESCE(?, bill_state),
//       bill_postal_code = COALESCE(?, bill_postal_code),
//       bill_country     = COALESCE(?, bill_country),
//
//       status = COALESCE(?, status),
//
//       paid_at = CASE
//         WHEN ? = 'paid' AND paid_at IS NULL THEN datetime('now')
//         ELSE paid_at
//       END,
//
//       metadata_json = ?
//     WHERE id = ?
//   `);
//
//     const updateRefunded = db.prepare(`
//     UPDATE orders
//     SET status = 'refunded'
//     WHERE stripe_payment_intent_id = ?
//   `);
//
//     return (req, res) => {
//         const sig = req.headers["stripe-signature"];
//
//         let event;
//         try {
//             // req.body is a Buffer because we used express.raw()
//             event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
//         } catch (err) {
//             return res.status(400).send(`Webhook Error: ${err.message}`);
//         }
//
//         // ---- Dedup / audit ----
//         try {
//             insEvent.run(event.id, event.type, JSON.stringify(event));
//         } catch (e) {
//             // duplicate event => already processed (unique event_id)
//             if (String(e.message || "").includes("UNIQUE")) {
//                 return res.json({ received: true, duplicate: true });
//             }
//             // other DB error
//             return res.status(500).json({ error: "DB error inserting stripe_events", details: e.message });
//         }
//
//         try {
//             // ---- Handle events ----
//             if (
//                 event.type === "checkout.session.completed" ||
//                 event.type === "checkout.session.async_payment_succeeded" ||
//                 event.type === "checkout.session.async_payment_failed" ||
//                 event.type === "checkout.session.expired"
//             ) {
//                 const session = event.data.object;
//
//                 const orderId = getOrderIdForSession(db, session);
//                 if (!orderId) {
//                     // We can’t update without a matching order; still acknowledge so Stripe doesn't retry forever
//                     markProcessed.run(event.id);
//                     return res.json({ received: true, warning: "No matching order found", session_id: session.id });
//                 }
//
//                 const customer = session.customer_details || {};
//                 const shipping = session.shipping_details || {};
//                 const billAddr = pickAddr(customer.address);
//                 const shipAddr = pickAddr(shipping.address);
//
//                 const subtotal = Number.isInteger(session.amount_subtotal) ? session.amount_subtotal : null;
//                 const total = Number.isInteger(session.amount_total) ? session.amount_total : null;
//                 const tax = Number.isInteger(session.total_details?.amount_tax) ? session.total_details.amount_tax : null;
//                 const shippingCents = Number.isInteger(session.total_details?.amount_shipping)
//                     ? session.total_details.amount_shipping
//                     : null;
//
//                 // Decide final status
//                 let newStatus = null;
//                 if (event.type === "checkout.session.expired") newStatus = "canceled";
//                 else if (event.type === "checkout.session.async_payment_failed") newStatus = "canceled";
//                 else {
//                     // completed or async_succeeded
//                     const ps = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
//                     if (ps === "paid" || ps === "no_payment_required") newStatus = "paid";
//                     // else keep existing status (pending)
//                 }
//
//                 // Merge metadata_json
//                 const existing = getOrderMeta.get(orderId);
//                 const meta = safeJsonParse(existing?.metadata_json);
//                 meta.stripe = {
//                     ...(meta.stripe || {}),
//                     last_event_id: event.id,
//                     last_event_type: event.type,
//                     session_id: session.id,
//                     payment_status: session.payment_status,
//                     payment_intent: session.payment_intent || null,
//                 };
//
//                 updateOrder.run(
//                     session.id,
//                     session.payment_intent || null,
//                     session.customer || null,
//
//                     session.currency || null,
//                     subtotal,
//                     tax,
//                     shippingCents,
//                     total,
//
//                     customer.email || null,
//                     customer.phone || null,
//                     customer.name || null,
//
//                     shipping.name || null,
//                     shipAddr.line1,
//                     shipAddr.line2,
//                     shipAddr.city,
//                     shipAddr.state,
//                     shipAddr.postal_code,
//                     shipAddr.country,
//
//                     customer.name || null,
//                     billAddr.line1,
//                     billAddr.line2,
//                     billAddr.city,
//                     billAddr.state,
//                     billAddr.postal_code,
//                     billAddr.country,
//
//                     newStatus,
//                     newStatus || "pending", // used only for paid_at CASE check
//                     JSON.stringify(meta),
//                     orderId
//                 );
//
//                 markProcessed.run(event.id);
//                 return res.json({ received: true });
//             }
//
//             // Refunds (optional but useful)
//             if (event.type === "charge.refunded") {
//                 const charge = event.data.object;
//                 const pi = charge.payment_intent;
//                 if (pi) updateRefunded.run(pi);
//                 markProcessed.run(event.id);
//                 return res.json({ received: true });
//             }
//
//             // Not handling this event type, but still mark processed
//             markProcessed.run(event.id);
//             return res.json({ received: true, ignored: true, type: event.type });
//         } catch (err) {
//             // Stripe will retry if we non-200; that’s OK if DB temporarily fails
//             return res.status(500).json({ error: "Webhook handler failed", details: err.message });
//         }
//     };
// };

// backend/services/public/stripeWebhook.js
// Verifies Stripe signature (raw body) + updates orders table (Better-SQLite3)

function safeJsonParse(s) {
    if (!s) return {};
    try {
        return JSON.parse(s);
    } catch {
        return {};
    }
}

function pickAddr(a) {
    if (!a) return {};
    return {
        line1: a.line1 || null,
        line2: a.line2 || null,
        city: a.city || null,
        state: a.state || null,
        postal_code: a.postal_code || null,
        country: a.country || null,
    };
}

function getOrderIdForSession(db, session) {
    const metaOrderId = session?.metadata?.order_id;
    if (metaOrderId) {
        const row = db.prepare(`SELECT id FROM orders WHERE id = ?`).get(Number(metaOrderId));
        if (row?.id) return row.id;
    }

    // fallback 1: match by stored session id
    const bySession = db
        .prepare(`SELECT id FROM orders WHERE stripe_checkout_session_id = ?`)
        .get(session.id);
    if (bySession?.id) return bySession.id;

    // fallback 2: match by order_number from metadata or client_reference_id
    const orderNumber = session?.metadata?.order_number || session?.client_reference_id;
    if (orderNumber) {
        const byNum = db.prepare(`SELECT id FROM orders WHERE order_number = ?`).get(orderNumber);
        if (byNum?.id) return byNum.id;
    }

    return null;
}

module.exports = ({ db, stripe }) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        throw new Error("Missing STRIPE_WEBHOOK_SECRET in env.");
    }

    const insEvent = db.prepare(`
    INSERT INTO stripe_events (event_id, event_type, payload_json)
    VALUES (?, ?, ?)
  `);

    const markProcessed = db.prepare(`
    UPDATE stripe_events
    SET processed_at = datetime('now')
    WHERE event_id = ?
  `);

    const getOrderMeta = db.prepare(`SELECT metadata_json FROM orders WHERE id = ?`);

    // NOTE: schema.sql now uses split status columns:
    // - order_status ('placed','cancelled','completed')
    // - payment_status ('pending','paid','refunded')
    // - fulfillment_status ('unfulfilled','fulfilled')
    // - shipping_status ('pending','shipped','delivered')
    const updateOrder = db.prepare(`
    UPDATE orders SET
      stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
      stripe_payment_intent_id   = COALESCE(?, stripe_payment_intent_id),
      stripe_customer_id         = COALESCE(?, stripe_customer_id),

      currency       = COALESCE(?, currency),
      subtotal_cents = COALESCE(?, subtotal_cents),
      tax_cents      = COALESCE(?, tax_cents),
      shipping_cents = COALESCE(?, shipping_cents),
      total_cents    = COALESCE(?, total_cents),

      customer_email = COALESCE(?, customer_email),
      customer_phone = COALESCE(?, customer_phone),
      customer_name  = COALESCE(?, customer_name),

      ship_name        = COALESCE(?, ship_name),
      ship_line1       = COALESCE(?, ship_line1),
      ship_line2       = COALESCE(?, ship_line2),
      ship_city        = COALESCE(?, ship_city),
      ship_state       = COALESCE(?, ship_state),
      ship_postal_code = COALESCE(?, ship_postal_code),
      ship_country     = COALESCE(?, ship_country),

      bill_name        = COALESCE(?, bill_name),
      bill_line1       = COALESCE(?, bill_line1),
      bill_line2       = COALESCE(?, bill_line2),
      bill_city        = COALESCE(?, bill_city),
      bill_state       = COALESCE(?, bill_state),
      bill_postal_code = COALESCE(?, bill_postal_code),
      bill_country     = COALESCE(?, bill_country),

      order_status   = COALESCE(?, order_status),
      payment_status = COALESCE(?, payment_status),

      paid_at = CASE
        WHEN ? = 'paid' AND paid_at IS NULL THEN datetime('now')
        ELSE paid_at
      END,

      metadata_json = ?
    WHERE id = ?
  `);

    const updateRefunded = db.prepare(`
    UPDATE orders
    SET
      payment_status = 'refunded',
      order_status = CASE
        WHEN order_status = 'placed' THEN 'cancelled'
        ELSE order_status
      END
    WHERE stripe_payment_intent_id = ?
  `);

    return (req, res) => {
        const sig = req.headers["stripe-signature"];

        let event;
        try {
            // req.body is a Buffer because we used express.raw()
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // ---- Dedup / audit ----
        try {
            insEvent.run(event.id, event.type, JSON.stringify(event));
        } catch (e) {
            // duplicate event => already processed (unique event_id)
            if (String(e.message || "").includes("UNIQUE")) {
                return res.json({ received: true, duplicate: true });
            }
            return res.status(500).json({ error: "DB error inserting stripe_events", details: e.message });
        }

        try {
            // ---- Handle checkout session events ----
            if (
                event.type === "checkout.session.completed" ||
                event.type === "checkout.session.async_payment_succeeded" ||
                event.type === "checkout.session.async_payment_failed" ||
                event.type === "checkout.session.expired"
            ) {
                const session = event.data.object;

                const orderId = getOrderIdForSession(db, session);
                if (!orderId) {
                    markProcessed.run(event.id);
                    return res.json({ received: true, warning: "No matching order found", session_id: session.id });
                }

                const customer = session.customer_details || {};
                const shipping = session.shipping_details || {};
                const billAddr = pickAddr(customer.address);
                const shipAddr = pickAddr(shipping.address);

                const subtotal = Number.isInteger(session.amount_subtotal) ? session.amount_subtotal : null;
                const total = Number.isInteger(session.amount_total) ? session.amount_total : null;
                const tax = Number.isInteger(session.total_details?.amount_tax) ? session.total_details.amount_tax : null;
                const shippingCents = Number.isInteger(session.total_details?.amount_shipping)
                    ? session.total_details.amount_shipping
                    : null;

                // Decide status updates (schema.sql split columns)
                let orderStatusToSet = null;   // 'placed' | 'cancelled' | 'completed'
                let paymentStatusToSet = null; // 'pending' | 'paid' | 'refunded'

                if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
                    orderStatusToSet = "cancelled";
                } else {
                    // completed or async_payment_succeeded
                    const ps = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
                    if (ps === "paid" || ps === "no_payment_required") paymentStatusToSet = "paid";
                }

                // Merge metadata_json
                const existing = getOrderMeta.get(orderId);
                const meta = safeJsonParse(existing?.metadata_json);
                meta.stripe = {
                    ...(meta.stripe || {}),
                    last_event_id: event.id,
                    last_event_type: event.type,
                    session_id: session.id,
                    payment_status: session.payment_status,
                    payment_intent: session.payment_intent || null,
                };

                updateOrder.run(
                    session.id,
                    session.payment_intent || null,
                    session.customer || null,

                    session.currency || null,
                    subtotal,
                    tax,
                    shippingCents,
                    total,

                    customer.email || null,
                    customer.phone || null,
                    customer.name || null,

                    shipping.name || null,
                    shipAddr.line1,
                    shipAddr.line2,
                    shipAddr.city,
                    shipAddr.state,
                    shipAddr.postal_code,
                    shipAddr.country,

                    customer.name || null,
                    billAddr.line1,
                    billAddr.line2,
                    billAddr.city,
                    billAddr.state,
                    billAddr.postal_code,
                    billAddr.country,

                    orderStatusToSet,
                    paymentStatusToSet,

                    // paid_at CASE check param
                    paymentStatusToSet === "paid" ? "paid" : "pending",

                    JSON.stringify(meta),
                    orderId
                );

                markProcessed.run(event.id);
                return res.json({ received: true });
            }

            // ---- Refunds ----
            if (event.type === "charge.refunded") {
                const charge = event.data.object;
                const pi = charge.payment_intent;
                if (pi) updateRefunded.run(pi);
                markProcessed.run(event.id);
                return res.json({ received: true });
            }

            // Not handling this event type, but still mark processed
            markProcessed.run(event.id);
            return res.json({ received: true, ignored: true, type: event.type });
        } catch (err) {
            return res.status(500).json({ error: "Webhook handler failed", details: err.message });
        }
    };
};
