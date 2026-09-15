import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { logAudit } from "@/lib/audit";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import * as orderRepository from "@/server/repositories/order.repository";
import { savePaymentMethodFromSetupSession } from "@/server/services/payment-method.service";

// Una respuesta nueva por llamada: un `Response` module-scope se reusaría entre
// requests con el body ya consumido.
const ok = () => NextResponse.json({ ok: true });

// `payment_intent` viene expandido o como id según el evento.
function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;

  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

// Devuelve el id de la order o `null` si el evento no corresponde a ninguna
// (p. ej. `stripe trigger`, que inventa una sesión).
async function resolveOrderId(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const bySession = await orderRepository.getBySessionId(session.id);

  if (bySession) return bySession.id;

  // Rescate del `attachSession` que pudo fallar en la spec 017: la order existe
  // sin `session_id`. Se lo escribimos para que `markPaid` y la página de éxito
  // vuelvan a encontrarla por la vía normal.
  const orderId = session.metadata?.orderId;
  const byId = orderId ? await orderRepository.getById(orderId) : null;

  if (!byId) return null;

  await orderRepository.attachSession(byId.id, session.id);

  return byId.id;
}

async function handlePaid(session: Stripe.Checkout.Session) {
  // Métodos de pago diferidos avisan primero sin cobrar.
  if (session.payment_status === "unpaid") return ok();

  const orderId = await resolveOrderId(session);

  if (!orderId) {
    console.warn(
      `stripe-webhook: sin order para la sesión ${session.id}; se ignora`,
    );
    return ok();
  }

  const result = await orderRepository.markPaid(
    session.id,
    paymentIntentId(session),
  );

  // Ya estaba `paid`/`fulfilled`: es el mismo evento entregado dos veces.
  if (result.alreadyDone) return ok();

  try {
    await orderRepository.fulfill(result.order.id);
  } catch (error) {
    // La order queda `paid` y sin stock descontado. Se responde 200 porque
    // reintentar no crea stock; si el fallo fuese de infraestructura, este mismo
    // `logAudit` vuelve a tirar y la request termina en 500, que sí se reintenta.
    await db.transaction((tx) =>
      logAudit(tx, {
        actorId: null,
        action: "order.fulfillment_failed",
        entityType: "order",
        entityId: result.order.id,
        severity: "error",
        metadata: {
          stripeCheckoutId: session.id,
          reason: error instanceof Error ? error.message : String(error),
        },
      }),
    );

    console.error(
      `stripe-webhook: fulfillment fallido de la order ${result.order.id}`,
      error,
    );
  }

  return ok();
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET no está definida");
    return NextResponse.json(
      { error: "Configuración incompleta" },
      { status: 500 },
    );
  }

  // Body crudo: `request.json()` reserializa y rompe la firma.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Verificación criptográfica en vez de Zod: garantiza que el cuerpo lo firmó
  // Stripe y devuelve la unión discriminada `Stripe.Event` ya tipada.
  let event: Stripe.Event;

  try {
    // Sin header la verificación falla igual: mismo 400 que una firma inválida.
    event = stripe.webhooks.constructEvent(body, signature ?? "", secret);
  } catch (error) {
    console.error("stripe-webhook: firma inválida", error);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  // Todo lo que sigue responde 200 salvo error de infra: Stripe reintenta ante
  // 4xx y 5xx, y un evento que no nos corresponde no mejora con reintentos.
  switch (event.type) {
    case "checkout.session.completed":
      // Mismo evento para dos flujos: `setup` guarda la tarjeta, `payment`
      // acredita la compra.
      if (event.data.object.mode === "setup") {
        await savePaymentMethodFromSetupSession(event.data.object);
        return ok();
      }

      return handlePaid(event.data.object);

    case "checkout.session.async_payment_succeeded":
      return handlePaid(event.data.object);

    case "checkout.session.async_payment_failed":
      await orderRepository.markFailed(event.data.object.id);
      return ok();

    case "checkout.session.expired":
      await orderRepository.markExpired(event.data.object.id);
      return ok();

    default:
      return ok();
  }
}
