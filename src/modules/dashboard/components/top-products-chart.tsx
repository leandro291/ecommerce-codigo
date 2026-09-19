import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatPrice } from "@/lib/money";
import type { TopProduct } from "@/modules/dashboard/types/metrics";

// Mismo hex que `RevenueChart`: una sola medida, un solo color de dato.
const chartConfig = {
  quantity: {
    label: "Unidades",
    theme: { light: "#2a78d6", dark: "#3987e5" },
  },
} satisfies ChartConfig;

const MAX_LABEL_LENGTH = 22;

function truncateName(name: string): string {
  return name.length > MAX_LABEL_LENGTH
    ? `${name.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : name;
}

type TopProductsChartProps = {
  data: TopProduct[];
};

// Puramente presentacional: ya viene ordenado por cantidad DESC (T5).
export function TopProductsChart({ data }: TopProductsChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productos más vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Sin datos en el período.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((product) => ({
    ...product,
    label: truncateName(product.name),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos más vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 4 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex w-full flex-col gap-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: "var(--color-quantity)" }}
                          />
                          Unidades
                        </span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {Number(value).toLocaleString("es-PE")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Ingresos</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {formatPrice((item.payload as TopProduct).revenue)}
                        </span>
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
