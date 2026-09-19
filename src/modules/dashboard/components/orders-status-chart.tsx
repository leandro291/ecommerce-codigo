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
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type { OrdersByStatusPoint } from "@/modules/dashboard/types/metrics";

// Color por VALENCIA, no por slot categórico: el estado de un pedido no es una
// identidad arbitraria (qué producto, qué región), tiene significado -
// paid/fulfilled son buenos, failed/expired son malos, pending es neutro. Un
// set categórico (dataviz) asigna verde y naranja sin criterio semántico y
// puede leer al revés (falló en verde, pagado en naranja). Cada familia usa el
// mismo matiz en dos intensidades (el estado más avanzado, más saturado); la
// separación entre familias está reforzada en luminosidad/croma, no solo en
// matiz, para que siga siendo legible bajo daltonismo rojo-verde: validado con
// el validador de dataviz en modo `--pairs all` (todas las combinaciones, no
// solo vecinas) - ΔE normal-vision ≥ 15.8 y ΔE protan/deutan ≥ 7.9 en ambos
// modos. Orden fijo: un estado conserva su color entre renders sin importar
// cuáles estén presentes. La paleta hex se queda acá (es de Recharts); las
// etiquetas salen de `@/lib/order-status`, que el badge del panel (024)
// comparte junto con el criterio de valencia - no redefinirlo ahí.
const chartConfig = {
  pending: {
    label: ORDER_STATUS_LABEL.pending,
    theme: { light: "#6a6964", dark: "#7e7a6f" },
  },
  paid: {
    label: ORDER_STATUS_LABEL.paid,
    theme: { light: "#7fb57b", dark: "#a6d2a2" },
  },
  failed: {
    label: ORDER_STATUS_LABEL.failed,
    theme: { light: "#bb071e", dark: "#de3b3d" },
  },
  expired: {
    label: ORDER_STATUS_LABEL.expired,
    theme: { light: "#c27141", dark: "#db956e" },
  },
  fulfilled: {
    label: ORDER_STATUS_LABEL.fulfilled,
    theme: { light: "#006300", dark: "#008100" },
  },
} satisfies ChartConfig;

type OrdersStatusChartProps = {
  data: OrdersByStatusPoint[];
};

// Puramente presentacional. `aria-label` da la alternativa textual del AC de
// accesibilidad: el color nunca es el único portador del dato.
export function OrdersStatusChart({ data }: OrdersStatusChartProps) {
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const summary = data
    .map((point) => `${ORDER_STATUS_LABEL[point.status]}: ${point.count}`)
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
