import { NextResponse, type NextRequest } from "next/server";

import { resolveRange } from "@/modules/dashboard/lib/metrics-range";
import { fillDays } from "@/modules/dashboard/lib/revenue-series";
import { metricsQuerySchema } from "@/modules/dashboard/schemas/metrics.schema";
import type { DashboardMetrics } from "@/modules/dashboard/types/metrics";
import { requirePermission } from "@/lib/permissions";
import * as orderRepository from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET(request: NextRequest) {
  const guard = await requirePermission("dashboard.read");

  if (!guard.ok) return guard.response;

  const query = metricsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  const tzOffset = query.data.tzOffset ?? 0;
  const { from, to, days, calendarFrom } = resolveRange(query.data.range, tzOffset);
  const orderRange = { from, to };

  try {
    const [kpis, revenueByDay, topProducts, ordersByStatus, lowStock] =
      await Promise.all([
        orderRepository.getSalesKpis(orderRange),
        orderRepository.getRevenueByDay(orderRange, tzOffset),
        orderRepository.getTopProducts(orderRange),
        orderRepository.getOrdersByStatus(orderRange),
        productRepository.countLowStock(),
      ]);

    const averageTicket = kpis.orders === 0 ? 0 : Math.round(kpis.revenue / kpis.orders);

    const metrics: DashboardMetrics = {
      kpis: { ...kpis, averageTicket, lowStock },
      revenueByDay: fillDays(calendarFrom, days, revenueByDay),
      topProducts,
      ordersByStatus,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("GET /api/admin/metrics", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las métricas" },
      { status: 500 },
    );
  }
}
