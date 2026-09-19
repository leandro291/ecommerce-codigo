"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCards } from "@/modules/dashboard/components/kpi-cards";
import { OrdersStatusChart } from "@/modules/dashboard/components/orders-status-chart";
import { RevenueChart } from "@/modules/dashboard/components/revenue-chart";
import { TopProductsChart } from "@/modules/dashboard/components/top-products-chart";
import { useMetrics } from "@/modules/dashboard/hooks/use-metrics";
import type { MetricsRange } from "@/modules/dashboard/types/metrics";

const RANGE_LABEL: Record<MetricsRange, string> = {
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
};

const RANGES = Object.keys(RANGE_LABEL) as MetricsRange[];

function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// Único "use client" del árbol (AC10): orquesta `useMetrics`, el rango y le
// pasa los datos ya resueltos a los componentes presentacionales de abajo.
export function MetricsView() {
  const [range, setRange] = useState<MetricsRange>("30d");
  const { data, isPending, isFetching, isError, error, refetch } = useMetrics(range);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={range}
          onValueChange={(value) => setRange(value as MetricsRange)}
        >
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {RANGE_LABEL[r]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* `isFetching` sin `isPending`: refetch de fondo (cada 30s), no debe
            tapar el contenido con skeletons. */}
        {isFetching && !isPending ? (
          <span className="text-xs text-muted-foreground">Actualizando…</span>
        ) : null}
      </div>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">
              No se pudieron cargar las métricas: {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : isPending || !data ? (
        <MetricsSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <KpiCards kpis={data.kpis} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueChart data={data.revenueByDay} />
            <TopProductsChart data={data.topProducts} />
          </div>
          <OrdersStatusChart data={data.ordersByStatus} />
        </div>
      )}
    </div>
  );
}
