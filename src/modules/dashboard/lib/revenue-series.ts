import type { RevenueByDayPoint } from "@/modules/dashboard/types/metrics";

// Rellena los días sin ventas con `revenue: 0` para que el gráfico muestre una
// serie consecutiva, no solo los días con filas en `rows`.
//
// `from` ya es el borde local del rango que calculó el handler con `tzOffset`
// (spec 020): acá se usa como contador puro en UTC (`Date.UTC` + `setUTCDate`),
// nunca se le vuelve a aplicar el offset. El huso ya quedó resuelto en el SQL
// que produjo `rows` (T4): si este función lo reaplicara, los días quedarían
// corridos y el AC4 se cae en silencio.
export function fillDays(
  from: Date,
  days: number,
  rows: RevenueByDayPoint[],
): RevenueByDayPoint[] {
  const revenueByDate = new Map(rows.map((row) => [row.date, row.revenue]));
  const base = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(base);
    day.setUTCDate(day.getUTCDate() + index);

    const date = day.toISOString().slice(0, 10);

    return { date, revenue: revenueByDate.get(date) ?? 0 };
  });
}
