import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { OrdersByStatusPoint } from "@/modules/dashboard/types/metrics";
import type { OrderStatus } from "@/server/db/schema";

// Identidad por categoría (5 estados = 5 slices): primeros 5 slots del set
// categórico validado (dataviz), orden fijo para que el mismo estado siempre
// tenga el mismo color entre renders, sin importar cuáles estén presentes.
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  expired: "Expirado",
  fulfilled: "Entregado",
};

const chartConfig = {
  pending: { label: STATUS_LABEL.pending, theme: { light: "#2a78d6", dark: "#3987e5" } },
  paid: { label: STATUS_LABEL.paid, theme: { light: "#eb6834", dark: "#d95926" } },
  failed: { label: STATUS_LABEL.failed, theme: { light: "#1baf7a", dark: "#199e70" } },
  expired: { label: STATUS_LABEL.expired, theme: { light: "#eda100", dark: "#c98500" } },
  fulfilled: { label: STATUS_LABEL.fulfilled, theme: { light: "#e87ba4", dark: "#d55181" } },
} satisfies ChartConfig;

type OrdersStatusChartProps = {
  data: OrdersByStatusPoint[];
};

// Puramente presentacional. `aria-label` da la alternativa textual del AC de
// accesibilidad: el color nunca es el único portador del dato.
export function OrdersStatusChart({ data }: OrdersStatusChartProps) {
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const summary = data
    .map((point) => `${STATUS_LABEL[point.status]}: ${point.count}`)
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por estado</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Sin datos en el período.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto h-64 w-full max-w-xs"
            role="img"
            aria-label={`Pedidos por estado: ${summary}`}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                outerRadius={80}
                strokeWidth={2}
                stroke="var(--background)"
              >
                {data.map((point) => (
                  <Cell key={point.status} fill={`var(--color-${point.status})`} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
