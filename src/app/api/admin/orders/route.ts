import { NextResponse, type NextRequest } from "next/server";

import { toDateRange } from "@/lib/date-range";
import { requirePermission } from "@/lib/permissions";
import { listAdminOrdersQuerySchema } from "@/modules/orders/schemas/order.schema";
import * as orderRepository from "@/server/repositories/order.repository";

// Solo lectura (024 §Alcance): cambiar estado, cancelar y borrar no son parte
// de este spec. Este archivo no exporta POST/PATCH/DELETE, así que Next
// responde 405 solo (AC7).
export async function GET(request: NextRequest) {
  const guard = await requirePermission("orders.read");

  if (!guard.ok) return guard.response;

  const query = listAdminOrdersQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  try {
    const page = await orderRepository.listForAdmin({
      // Día completo en la zona del navegador; sin `tzOffset`, UTC.
      ...toDateRange(query.data.from, query.data.to, query.data.tzOffset),
      status: query.data.status,
      search: query.data.search,
      limit: query.data.limit,
      cursor: query.data.cursor,
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("GET /api/admin/orders", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los pedidos" },
      { status: 500 },
    );
  }
}
