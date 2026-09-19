import type { OrderStatus } from "@/server/db/schema";

export type MetricsRange = "7d" | "30d" | "90d";

// Importes en CENTAVOS. `lowStock` es un conteo, no un importe.
export type SalesKpis = {
  revenue: number;
  orders: number;
  averageTicket: number;
  lowStock: number;
};

export type RevenueByDayPoint = {
  date: string; // "YYYY-MM-DD", ya resuelto en la zona local del cliente
  revenue: number;
};

export type TopProduct = {
  productId: string;
  name: string; // snapshot de `order_items.name`, no el nombre vivo del producto
  quantity: number;
  revenue: number;
};

export type OrdersByStatusPoint = {
  status: OrderStatus;
  count: number;
};

export type DashboardMetrics = {
  kpis: SalesKpis;
  revenueByDay: RevenueByDayPoint[];
  topProducts: TopProduct[];
  ordersByStatus: OrdersByStatusPoint[];
};
