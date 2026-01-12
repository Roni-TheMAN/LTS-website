// backend/services/stripePrices.js
const stripe = require("../../stripeClient");

async function createStripePrice({ stripeProductId, unitAmountCents, currency = "usd" }) {
    return stripe.prices.create({
        product: stripeProductId,
        unit_amount: unitAmountCents,
        currency,
        active: true,
    });
}

// ✅ Archive/deactivate old Stripe Price
async function archiveStripePrice({ stripePriceId }) {
    return stripe.prices.update(String(stripePriceId), { active: false });
}

module.exports = { createStripePrice, archiveStripePrice };
