import { NextResponse, type NextRequest } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { toDateRange } from "@/lib/date-range";
import { orderRangeQuerySchema } from "@/modules/orders/schemas/order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  const query = orderRangeQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Rango inválido", issues: query.error.issues },
      { status: 400 },
    );
  }

  try {
    const orders = await orderRepository.listByUser(
      guard.user.id,
      // Sin `tzOffset` (cliente viejo o llamada directa) el rango se recorta en
      // UTC, como antes.
      toDateRange(query.data.from, query.data.to, query.data.tzOffset),
    );

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders", error);
    return NextResponse.json(
      { error: "No se pudieron obtener tus compras" },
      { status: 500 },
    );
  }
}
