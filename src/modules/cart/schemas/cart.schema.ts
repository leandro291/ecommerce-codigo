import { z } from "zod";

// Tope por fila: más que esto es error de tipeo, no una compra.
export const MAX_QUANTITY = 99;

const quantity = z
  .number()
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad mínima es 1")
  .max(MAX_QUANTITY, `La cantidad máxima es ${MAX_QUANTITY}`);

export const productIdSchema = z.uuid("Producto inválido");

export const addToCartSchema = z.object({
  productId: productIdSchema,
  quantity: quantity.default(1),
});

// Para 0 se usa DELETE, no un PATCH con cantidad cero.
export const setQuantitySchema = z.object({ quantity });

export type AddToCartInput = z.input<typeof addToCartSchema>;
