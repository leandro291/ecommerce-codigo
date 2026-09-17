import { NextResponse, type NextRequest } from "next/server";

import { fillDays } from "@/modules/dashboard/lib/revenue-series";
import { metricsQuerySchema } from "@/modules/dashboard/schemas/metrics.schema";
import type {
  DashboardMetrics,
  MetricsRange,
} from "@/modules/dashboard/types/metrics";
import { requirePermission } from "@/lib/permissions";
import * as orderRepository from "@/server/repositories/order.repository";
import * as productRepository from "@/server/repositories/product.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_DAYS: Record<MetricsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

// Bordes del rango en la zona local del cliente (spec 020): se cuenta hacia
// atrás desde el arranque del día local de HOY, borde superior exclusivo.
// `calendarFrom` es un marcador de calendario puro (sin instante real, sin
// hora) para `fillDays`, que solo hace aritmética UTC sobre día/mes/año
// (T8): si le pasáramos el instante real, un offset al este de UTC lo
// corre a la fecha calendario anterior y la serie queda desalineada.
function resolveRange(range: MetricsRange, tzOffset: number) {
  const days = RANGE_DAYS[range];
  const todayLocalStr = new Date(Date.now() - tzOffset * 60_000)
    .toISOString()
    .slice(0, 10);

  const to = new Date(Date.parse(`${todayLocalStr}T00:00:00Z`) + tzOffset * 60_000);
  const from = new Date(to.getTime() - days * DAY_MS);

  const calendarFrom = new Date(`${todayLocalStr}T00:00:00Z`);
  calendarFrom.setUTCDate(calendarFrom.getUTCDate() - days);

  return { from, to, days, calendarFrom };
}

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
