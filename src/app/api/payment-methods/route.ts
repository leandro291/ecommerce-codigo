import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import * as paymentMethodRepository from "@/server/repositories/payment-method.repository";

// Sin Zod: no recibe body ni query. El `userId` sale de la sesión, nunca del
// pedido, así que no hay forma de listar tarjetas ajenas.
export async function GET() {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(
      await paymentMethodRepository.listByUser(guard.user.id),
    );
  } catch (error) {
    console.error("GET /api/payment-methods", error);
    return NextResponse.json(
      { error: "No se pudieron obtener tus tarjetas" },
      { status: 500 },
    );
  }
}
