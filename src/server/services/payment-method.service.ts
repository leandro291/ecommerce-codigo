import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import type { User } from "@/server/db/schema";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";
import * as userRepository from "@/server/repositories/user.repository";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
// Misma etiqueta de integración que el checkout de pago: agrupa los flujos en el
// Dashboard sin inventar un sufijo por sesión.
const INTEGRATION_IDENTIFIER = "ecommerce-checkout-zqrmhtvb";

// El Customer de Stripe se crea al vuelo la primera vez que el usuario guarda
// una tarjeta. Sin backfill: quien nunca guardó sigue pagando por email.
export async function ensureStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    metadata: { userId: user.id },
  });

  await userRepository.setStripeCustomerId(user.id, customer.id);

  return customer.id;
}

// `mode: "setup"` = SetupIntent hospedado: Stripe cobra $0 y solo guarda el
// medio de pago. El PAN nunca pasa por este dominio.
export async function createSetupSession(user: User): Promise<string> {
  const customerId = await ensureStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    // Obligatoria en `setup` mode mientras no se pase `payment_method_types`
    // (verificado en la doc de `2026-08-26.dahlia`).
    currency: "pen",
    customer: customerId,
    success_url: `${APP_URL}/profile?tab=cards&setup=done`,
    cancel_url: `${APP_URL}/profile?tab=cards`,
    client_reference_id: user.id,
    integration_identifier: INTEGRATION_IDENTIFIER,
  });

  if (!session.url) {
    throw new Error(`Stripe no devolvió URL para la sesión ${session.id}`);
  }

  return session.url;
}

// La llama el webhook con la sesión del evento (sin expandir): el `setup_intent`
// se resuelve acá para llegar al PaymentMethod y a sus `brand`/`last4`.
export async function savePaymentMethodFromSetupSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;

  const userId = session.client_reference_id;

  if (!setupIntentId || !userId) {
    console.warn(
      `stripe-webhook: sesión de setup ${session.id} sin setup_intent o sin usuario; se ignora`,
    );
    return;
  }

  // Una sesión inventada (`stripe trigger`) trae un `client_reference_id` que no
  // es un usuario nuestro: sin este chequeo el INSERT rompe la FK y devuelve 500.
  const user = await userRepository.findById(userId);

  if (!user) {
    console.warn(
      `stripe-webhook: sesión de setup ${session.id} de un usuario inexistente; se ignora`,
    );
    return;
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });

  const paymentMethod = setupIntent.payment_method;

  // Sin `expand` sería el id suelto, que no trae `card`. Un medio de pago que no
  // sea tarjeta no tiene `brand`/`last4` que listar.
  if (
    !paymentMethod ||
    typeof paymentMethod === "string" ||
    !paymentMethod.card
  ) {
    console.warn(
      `stripe-webhook: setup ${setupIntentId} sin tarjeta asociada; se ignora`,
    );
    return;
  }

  await paymentMethodRepository.create({
    userId: user.id,
    stripePaymentMethodId: paymentMethod.id,
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
  });
}

// `false` = no existe o es de otro usuario: el handler lo traduce a 404 (un 403
// confirmaría que ese id existe).
export async function removePaymentMethod(
  user: User,
  id: string,
): Promise<boolean> {
  const stored = await paymentMethodRepository.findOwned(user.id, id);

  if (!stored) return false;

  // Detach primero: si fallara el DELETE local, el usuario reintenta y el
  // segundo detach ya no encuentra nada (caso tolerado abajo). Al revés no
  // habría forma de recuperar el id para desasociarla.
  try {
    await stripe.paymentMethods.detach(stored.stripePaymentMethodId);
  } catch (error) {
    // Stripe rechaza desasociar lo que ya no está asociado: el objetivo está
    // cumplido igual, solo falta borrar la fila local.
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error;

    console.warn(
      `payment-methods: detach de ${stored.stripePaymentMethodId} rechazado por Stripe`,
      error.message,
    );
  }

  return paymentMethodRepository.deleteOwned(user.id, id);
}
