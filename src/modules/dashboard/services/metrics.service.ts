import { api } from "@/lib/axios";
import type { MetricsQuery } from "@/modules/dashboard/schemas/metrics.schema";
import type { DashboardMetrics } from "@/modules/dashboard/types/metrics";

export async function getMetrics(query: MetricsQuery): Promise<DashboardMetrics> {
  const { data } = await api.get<DashboardMetrics>("/admin/metrics", {
    params: query,
  });

  return data;
}
