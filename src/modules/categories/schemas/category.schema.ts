import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres"),
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(80, "El slug no puede superar los 80 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "La descripción no puede superar los 500 caracteres")
    .nullish(),
  imageUrl: z.url("URL inválida").nullish(),
  isActive: z.boolean().optional(),
  position: z
    .number()
    .int("La posición debe ser un entero")
    .min(0, "La posición no puede ser negativa")
    .optional(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((values) => Object.keys(values).length > 0, "Nada para actualizar");

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const categoryIdSchema = z.uuid("Identificador inválido");

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
