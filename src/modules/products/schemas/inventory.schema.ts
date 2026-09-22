import { z } from "zod";

// Tope del ajuste y del punto de reposición: un dedo pegado al teclado no puede
// meter un millón de unidades. Todo en enteros, nunca decimales.
const MAX_UNITS = 100_000;

// Query de la vista: todo llega como string desde la URL, `stringbool` en vez de
// `coerce.boolean()` (que convertiría "false" en `true`).
export const inventoryQuerySchema = z.object({
  onlyLow: z.stringbool().optional(),
  search: z
    .string()
    .trim()
    .max(80, "La búsqueda no puede superar los 80 caracteres")
    .optional(),
  category: z.uuid("Categoría inválida").optional(),
});

export const adjustInventorySchema = z
  .object({
    // Delta, no stock absoluto: dos reposiciones simultáneas se suman en vez de
    // pisarse. `0` no es un ajuste, es ruido en la bitácora.
    delta: z
      .number("Ingresá una cantidad válida")
      .int("La cantidad debe ser un entero")
      .min(-MAX_UNITS, "El ajuste es demasiado grande")
      .max(MAX_UNITS, "El ajuste es demasiado grande")
      .refine((value) => value !== 0, "El ajuste no puede ser cero")
      .optional(),
    reorderPoint: z
      .number("Ingresá un punto de reposición válido")
      .int("El punto de reposición debe ser un entero")
      .min(0, "El punto de reposición no puede ser negativo")
      .max(MAX_UNITS, "El punto de reposición es demasiado alto")
      .optional(),
  })
  // Mismo criterio que `updateProductSchema`: un PATCH vacío es un 400.
  .refine((values) => Object.keys(values).length > 0, "Nada para ajustar");

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
