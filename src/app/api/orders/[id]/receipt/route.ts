import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { orderIdSchema } from "@/modules/orders/schemas/order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

// Función y no constante: un `Response` tiene body de un solo uso, compartir la
// misma instancia entre pedidos la rompe.
function notFound() {
  return NextResponse.json(
    { error: "No encontramos esa compra" },
    { status: 404 },
  );
}

type Ctx = RouteContext<"/api/orders/[id]/receipt">;

// La boleta no se guarda en base: el `receipt_url` es un link firmado por
// Stripe y se pide on-demand, un pedido por click.
export async function GET(_request: Request, ctx: Ctx) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  const parsedId = orderIdSchema.safeParse((await ctx.params).id);

  if (!parsedId.success) return notFound();

  try {
    const order = await orderRepository.getById(parsedId.data);

    // Ownership por 404, no 403: un 403 confirmaría que ese id existe. Stripe
    // no se toca hasta después de este chequeo.
    if (!order || order.userId !== guard.user.id) return notFound();

    if (!order.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "Esta compra todavía no tiene boleta disponible" },
        { status: 409 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.stripePaymentIntentId,
      { expand: ["latest_charge"] },
    );

    // Con `expand` el charge llega como objeto; el string sería el id sin
    // expandir, que no sirve para leer la boleta.
    const charge = paymentIntent.latest_charge;
    const url =
      charge && typeof charge !== "string" ? charge.receipt_url : null;

    if (!url) {
      return NextResponse.json(
        { error: "Stripe todavía no emitió la boleta de esta compra" },
        { status: 409 },
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("GET /api/orders/[id]/receipt", error);
    return NextResponse.json(
      { error: "No se pudo obtener la boleta" },
      { status: 500 },
    );
  }
}
