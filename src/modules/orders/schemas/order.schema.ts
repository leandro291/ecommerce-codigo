import { z } from "zod";

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

