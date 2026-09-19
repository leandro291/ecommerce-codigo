import { z } from "zod";

// `range` siempre tiene un valor: a diferencia de `orderRangeQuerySchema` (020),
// acá no hace falta un estado parcial en el cliente, así que el `.default()` no
// rompe nada.
export const metricsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
  // Minutos de `Date.prototype.getTimezoneOffset()` (positivo al oeste de UTC).
  // Fallback a 0 (UTC) en el handler, igual que el spec 020.
  tzOffset: z.coerce.number().int().min(-840).max(840).optional(),
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
