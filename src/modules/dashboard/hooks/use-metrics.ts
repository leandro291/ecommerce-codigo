"use client";

import { useQuery } from "@tanstack/react-query";

import * as metricsService from "@/modules/dashboard/services/metrics.service";
import type { MetricsRange } from "@/modules/dashboard/types/metrics";

// `tzOffset` entra en la key junto con `range` (mismo criterio que `ordersKey`,
// spec 020): rangos de distinta zona no comparten caché.
export function metricsKey(range: MetricsRange, tzOffset: number) {
  return ["metrics", { range, tzOffset }] as const;
}

export function useMetrics(range: MetricsRange) {
  const tzOffset = new Date().getTimezoneOffset();

  return useQuery({
    queryKey: metricsKey(range, tzOffset),
    queryFn: () => metricsService.getMetrics({ range, tzOffset }),
    refetchInterval: 30_000,
  });
}
