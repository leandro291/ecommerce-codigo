import { z } from "zod";

import { parseCursor } from "@/lib/cursor";

// `YYYY-MM-DD`, exactamente lo que emite `<input type="date">`. Sin parámetros
// el rango lo resuelve el cliente (mes actual); acá ambos son opcionales.
export const orderRangeQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    // Minutos de `Date.prototype.getTimezoneOffset()` (positivo al oeste de
    // UTC). Opcional y sin `.default()`: el tipo de salida se usa como estado
    // parcial en el cliente. El fallback a 0 lo pone el handler.
    tzOffset: z.coerce.number().int().min(-840).max(840).optional(),
  })
  // Comparación de strings `YYYY-MM-DD`: el orden lexicográfico es el
  // cronológico, no hace falta construir dos `Date`.
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    message: "«Desde» no puede ser posterior a «hasta»",
    path: ["from"],
  });

export type OrderRangeQuery = z.infer<typeof orderRangeQuerySchema>;

// Un id con formato roto es un id que no existe: el handler lo trata como 404,
// igual que una orden ajena (no confirmar qué ids existen).
export const orderIdSchema = z.uuid();

// Mismos cinco valores que el enum `order_status` del schema Drizzle, escritos
// acá para no arrastrar la BD al bundle (igual que `auditSeveritySchema`). Que
// no se desincronicen lo garantiza el tipo: el handler pasa este valor a un
// parámetro tipado `OrderStatus` y un literal de más no compila.
export const orderStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "expired",
  "fulfilled",
]);

// Segunda aparición del envoltorio (la primera es `audit-log.schema.ts`): el
// parseo compartido ya vive en `@/lib/cursor`, y lo único que se repite son
// estas líneas que convierten su throw en un issue de Zod → 400. Se extrae a la
// tercera (CLAUDE.md §6).
const cursorSchema = z.string().transform((raw, ctx) => {
  try {
    return parseCursor(raw);
  } catch {
    ctx.addIssue({ code: "custom", message: "Cursor inválido" });
    return z.NEVER;
  }
});

// Listado del panel: a diferencia del historial del cliente, acepta filtro por
// estado, búsqueda de cliente y paginado por cursor.
export const listAdminOrdersQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  tzOffset: z.coerce.number().int().min(-840).max(840).optional(),
  status: orderStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: cursorSchema.optional(),
});

export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuerySchema>;

