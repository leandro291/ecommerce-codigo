import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatPrice } from "@/lib/money";
import type { RevenueByDayPoint } from "@/modules/dashboard/types/metrics";

// Slot 1 del set categórico validado (dataviz): serie única, sin necesidad de
// distinguir contra vecinos. Mismo hex para todos los gráficos de una medida.
const chartConfig = {
  revenue: {
    label: "Ingresos",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

function formatDayTick(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function formatTooltipLabel(label: unknown): string {
  return typeof label === "string" ? formatDayTick(label) : String(label ?? "");
}

type RevenueChartProps = {
  data: RevenueByDayPoint[];
};

// Puramente presentacional: recibe la serie ya rellenada por `fillDays` (T8).
export function RevenueChart({ data }: RevenueChartProps) {
  const hasRevenue = data.some((point) => point.revenue > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por día</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRevenue ? (
          <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Sin datos en el período.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <AreaChart data={data} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDayTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(value: number) => formatPrice(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatTooltipLabel}
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: "var(--color-revenue)" }}
                          />
                          Ingresos
                        </span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {formatPrice(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                dataKey="revenue"
                type="monotone"
                stroke="var(--color-revenue)"
                fill="var(--color-revenue)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
