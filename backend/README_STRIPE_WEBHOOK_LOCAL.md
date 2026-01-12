# Stripe Webhooks (Local Development)

This project uses **Stripe webhooks** to mark orders as **paid** and to copy **customer + shipping/billing info** into the `orders` table.

⚠️ Important: **The Return URL page is NOT reliable** for final order status.  
The webhook is the source of truth.

---

## What this webhook does

When Stripe sends events like:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`

…the backend webhook handler updates:

- `orders.status` → `paid` / `canceled` / `refunded`
- `orders.paid_at`
- `orders.customer_*`
- `orders.ship_*`, `orders.bill_*`
- Stripe IDs (`stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_customer_id`)
- totals (`subtotal_cents`, `tax_cents`, `shipping_cents`, `total_cents`)

---

## Why Stripe CLI is required for local dev

Stripe cannot call `localhost` directly.  
For local development we use **Stripe CLI** as a bridge:

Stripe → (Stripe CLI) → `http://localhost:<PORT>/api/public/stripe/webhook`

If the Stripe CLI terminal is closed (or you press **Quit**), webhooks stop.

---

## Requirements

### 1) Install Stripe CLI (Windows)
Run PowerShell as Admin:

```powershell
winget install Stripe.StripeCLI

striep login 

stripe listen --forward-to localhost:5001/api/public/stripe/webhook

Copy key and put it in env 
