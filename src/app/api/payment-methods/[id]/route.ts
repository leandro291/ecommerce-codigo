import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { paymentMethodIdParamSchema } from "@/modules/customers/schemas/payment-method.schema";
import { removePaymentMethod } from "@/server/services/payment-method.service";

// Función y no constante: un `Response` tiene body de un solo uso, compartir la
// misma instancia entre pedidos la rompe.
function notFound() {
  return NextResponse.json(
    { error: "No encontramos esa tarjeta" },
    { status: 404 },
  );
}

type Ctx = RouteContext<"/api/payment-methods/[id]">;

export async function DELETE(_request: Request, ctx: Ctx) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  const parsed = paymentMethodIdParamSchema.safeParse(await ctx.params);

  if (!parsed.success) return notFound();

  try {
    // Ownership por 404, no 403: un 403 confirmaría que ese id existe.
    const removed = await removePaymentMethod(guard.user, parsed.data.id);

    if (!removed) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/payment-methods/[id]", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la tarjeta" },
      { status: 500 },
    );
  }
}
