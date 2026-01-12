// backend/services/stripeProducts.js
const stripe = require("../../stripeClient");

function normalizeDescription(description) {
    if (description === undefined) return undefined;
    if (description === null) return null; // allow explicit clear if Stripe supports it
    const s = String(description);
    return s.length ? s : undefined;
}

async function createStripeProduct({ name, description, active }) {
    const payload = {
        name: String(name),
    };

    const desc = normalizeDescription(description);
    if (desc !== undefined) payload.description = desc;

    if (typeof active === "boolean") payload.active = active;

    return stripe.products.create(payload);
}

async function updateStripeProduct({ id, name, description, active }) {
    const payload = {};

    if (name !== undefined) payload.name = String(name);

    const desc = normalizeDescription(description);
    if (desc !== undefined) payload.description = desc;

    if (typeof active === "boolean") payload.active = active;

    return stripe.products.update(String(id), payload);
}

module.exports = { createStripeProduct, updateStripeProduct };
