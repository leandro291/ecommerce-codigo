import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import type { CartItem, User } from "@/server/db/schema";
import * as cartRepository from "@/server/repositories/cart.repository";
import * as orderRepository from "@/server/repositories/order.repository";

// Unión discriminada en vez de clases de error: el handler la traduce a status
// sin `instanceof` ni jerarquías nuevas. Lo inesperado sigue siendo un throw.
export type CheckoutResult =
  { ok: true; url: string } | { ok: false; status: 400 | 409; error: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
// Stripe exige `expires_at` a 30 min o más en el futuro: el minuto extra es el
// colchón para la latencia de red, si no el valor exacto cae bajo el mínimo (400).
const SESSION_TTL_SECONDS = 31 * 60;
// Etiqueta fija de la integración para comparar flujos en el Dashboard; el
// sufijo aleatorio se fija una vez, no por sesión (Stripe las agrupa por él).
const INTEGRATION_IDENTIFIER = "ecommerce-checkout-zqrmhtvb";

// Stripe solo puede descargar imágenes públicas: en local (`http://localhost`)
// se omiten en vez de mandar una URL que no resuelve.
function absoluteImage(imageUrl: string | null): string[] {
  if (!imageUrl || !APP_URL) return [];

  const absolute = new URL(imageUrl, APP_URL).toString();

  return absolute.startsWith("https://") ? [absolute] : [];
}

// `customer` y `customer_email` son excluyentes: mandar los dos es un 400 de
// Stripe. Con Customer, la página hospedada lista las tarjetas ya guardadas.
// Los tres filtros de redisplay en vez de solo `always`: en esta integración lo
// único que ata una tarjeta al Customer es el alta explícita del perfil (el
// checkout de pago no guarda nada), así que el consentimiento está dado sea cual
// sea el `allow_redisplay` que Stripe le ponga al salir del setup.
function toCustomerParams(
  user: User,
): Pick<
  Stripe.Checkout.SessionCreateParams,
  "customer" | "customer_email" | "saved_payment_method_options"
> {
  if (!user.stripeCustomerId) return { customer_email: user.email };

  return {
    customer: user.stripeCustomerId,
    saved_payment_method_options: {
      allow_redisplay_filters: ["always", "limited", "unspecified"],
    },
  };
}

function toLineItem(
  item: CartItem,
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: item.quantity,
    price_data: {
      currency: "pen",
      // Ya está en centavos: es el mismo entero que espera Stripe, cero conversión.
      unit_amount: item.price,
      product_data: { name: item.name, images: absoluteImage(item.imageUrl) },
    },
  };
}

export async function createCheckoutSession(
  user: User,
): Promise<CheckoutResult> {
  // `listByUser` ya trae precio y stock vivos con JOIN: es la revalidación.
  const items = await cartRepository.listByUser(user.id);

  if (items.length === 0) {
    return { ok: false, status: 400, error: "Tu carrito está vacío" };
  }

  const sinStock = items.find((item) => item.stock < item.quantity);

  if (sinStock) {
    return {
      ok: false,
      status: 409,
      error: `«${sinStock.name}» ya no tiene stock suficiente. Revisá tu carrito.`,
    };
  }

  const orderId = await orderRepository.createPendingOrder(
    user.id,
    items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
    })),
  );

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: items.map(toLineItem),
      success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancel`,
      client_reference_id: user.id,
      ...toCustomerParams(user),
      metadata: { orderId },
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      integration_identifier: INTEGRATION_IDENTIFIER,
    },
    // Dos clicks seguidos reusan la misma sesión en vez de crear dos.
    { idempotencyKey: orderId },
  );

  if (!session.url) {
    throw new Error(`Stripe no devolvió URL para la sesión ${session.id}`);
  }

  await orderRepository.attachSession(orderId, session.id);

  return { ok: true, url: session.url };
}
