import { NextResponse, type NextRequest } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { orderRangeQuerySchema } from "@/modules/orders/schemas/order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

// `tzOffset` viene con la semántica de `getTimezoneOffset()`: UTC-5 → 300. La
// medianoche local de ese día es la medianoche UTC más el offset.
function startOfDay(date: string, tzOffset: number): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + tzOffset * 60_000);
}

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

  // Sin `tzOffset` (cliente viejo o llamada directa) se mantiene el
  // comportamiento anterior: UTC.
  const tzOffset = query.data.tzOffset ?? 0;

  try {
    const orders = await orderRepository.listByUser(guard.user.id, {
      from: query.data.from
        ? startOfDay(query.data.from, tzOffset)
        : undefined,
      // El "hasta" es inclusivo: se compara contra el arranque del día
      // siguiente.
      to: query.data.to
        ? new Date(startOfDay(query.data.to, tzOffset).getTime() + DAY_MS)
        : undefined,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders", error);
    return NextResponse.json(
      { error: "No se pudieron obtener tus compras" },
      { status: 500 },
    );
  }
}
