import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/money";
import type { SalesKpis } from "@/modules/dashboard/types/metrics";

const INTEGER_FORMAT = new Intl.NumberFormat("es-PE");

type KpiCardsProps = {
  kpis: SalesKpis;
};

// Puramente presentacional: recibe los KPIs ya resueltos, no toca `useMetrics`.
export function KpiCards({ kpis }: KpiCardsProps) {
  const items = [
    { label: "Ingresos", value: formatPrice(kpis.revenue) },
    // "pagados": cuenta solo `paid`/`fulfilled`, mientras que el gráfico de
    // estados cuenta los cinco. Sin el adjetivo, los dos números no cuadran en
    // pantalla y parecen un bug.
    { label: "Pedidos pagados", value: INTEGER_FORMAT.format(kpis.orders) },
    { label: "Ticket promedio", value: formatPrice(kpis.averageTicket) },
    // "(actual)": `countLowStock()` no recibe rango, es una foto del presente.
    // Al cambiar 7d/30d/90d esta card no se mueve, y sin el aclarador parece
    // congelada.
    { label: "Stock bajo (actual)", value: INTEGER_FORMAT.format(kpis.lowStock) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
