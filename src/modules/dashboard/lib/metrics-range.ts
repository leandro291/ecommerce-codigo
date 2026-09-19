import type { MetricsRange } from "@/modules/dashboard/types/metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_DAYS: Record<MetricsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export type ResolvedRange = {
  from: Date;
  to: Date;
  days: number;
  calendarFrom: Date;
};

// Bordes del rango en la zona local del cliente (spec 020): HOY entra
// completo (el dashboard es "en vivo", `refetchInterval: 30_000`), así que
// el borde superior es el arranque del día local de MAÑANA (exclusivo) y
// se cuenta hacia atrás `days` días desde ahí: "7d" = hoy + los 6 anteriores.
// `calendarFrom` es un marcador de calendario puro (sin instante real, sin
// hora) para `fillDays`, que solo hace aritmética UTC sobre día/mes/año
// (T8): si le pasáramos el instante real, un offset al este de UTC lo
// corre a la fecha calendario anterior y la serie queda desalineada. Se
// corre `days - 1` (no `days`) porque el último punto tiene que ser hoy,
// no ayer.
//
// `now` es un parámetro opcional (default `Date.now()`) solo para que el
// test sea determinista, sin fake timers.
export function resolveRange(
  range: MetricsRange,
  tzOffset: number,
  now: number = Date.now(),
): ResolvedRange {
  const days = RANGE_DAYS[range];
  const todayLocalStr = new Date(now - tzOffset * 60_000).toISOString().slice(0, 10);

  const startOfTomorrow = new Date(`${todayLocalStr}T00:00:00Z`);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

  const to = new Date(startOfTomorrow.getTime() + tzOffset * 60_000);
  const from = new Date(to.getTime() - days * DAY_MS);

  const calendarFrom = new Date(`${todayLocalStr}T00:00:00Z`);
  calendarFrom.setUTCDate(calendarFrom.getUTCDate() - (days - 1));

  return { from, to, days, calendarFrom };
}
