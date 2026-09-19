// `import type`: se borra en compilación, no arrastra el repositorio al bundle.
import type { OrderRange } from "@/server/repositories/order.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

// `tzOffset` viene con la semántica de `getTimezoneOffset()`: UTC-5 → 300. La
// medianoche local de ese día es la medianoche UTC más el offset.
function startOfDay(date: string, tzOffset: number): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + tzOffset * 60_000);
}

// Rango de un filtro `<input type="date">` a bordes de Date: el "desde" es
// inclusivo y el "hasta" también, así que se compara contra el arranque del día
// siguiente. Sin `tzOffset` (cliente viejo, llamada directa o la bitácora, que
// trabaja en UTC) el día se recorta en UTC.
export function toDateRange(
  from?: string,
  to?: string,
  tzOffset = 0,
): OrderRange {
  return {
    from: from ? startOfDay(from, tzOffset) : undefined,
    to: to ? new Date(startOfDay(to, tzOffset).getTime() + DAY_MS) : undefined,
  };
}
