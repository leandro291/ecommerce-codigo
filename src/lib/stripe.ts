import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY no está definida");
}

// Instancia única módulo-scope, igual que `db` y `api`. Nunca el patrón global
// deprecado (`stripe.apiKey = ...`).
export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-08-26.dahlia",
  typescript: true,
});
