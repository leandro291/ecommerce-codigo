import { z } from "zod";

const MAX_CENTS = 1_000_000_00;

// Base SIN refinamientos: en Zod, `.extend()` y `.partial()` no están
// disponibles sobre un schema ya refinado, así que create/update/form derivan
// de acá en vez de reescribir los campos tres veces.
const productFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "El nombre no puede superar los 120 caracteres"),
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(120, "El slug no puede superar los 120 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido")
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede superar los 2000 caracteres")
    .nullish(),
  categoryId: z.uuid("Categoría inválida"),
  price: z
    .number()
    .int("El precio debe estar en centavos")
    .min(0, "El precio no puede ser negativo")
    .max(MAX_CENTS, "El precio es demasiado alto"),
  compareAtPrice: z
    .number()
    .int("El precio comparativo debe estar en centavos")
    .min(0, "El precio comparativo no puede ser negativo")
    .max(MAX_CENTS, "El precio comparativo es demasiado alto")
    .nullish(),
  sku: z
    .string()
    .trim()
    .min(2, "El SKU debe tener al menos 2 caracteres")
    .max(60, "El SKU no puede superar los 60 caracteres")
    .nullish(),
  stock: z
    .number()
    .int("El stock debe ser un entero")
    .min(0, "El stock no puede ser negativo")
    .optional(),
  imageUrl: z.url("URL inválida").nullish(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

// En un PATCH parcial solo se puede evaluar si llegan los dos campos; contra el
// valor guardado no se valida (ver §10 del spec).
function compareAtIsHigher(values: {
  price?: number;
  compareAtPrice?: number | null;
}): boolean {
  if (values.price === undefined) return true;
  if (values.compareAtPrice === null || values.compareAtPrice === undefined) {
    return true;
  }

  return values.compareAtPrice > values.price;
}

const compareAtIssue = {
  error: "El precio comparativo debe ser mayor que el precio",
  path: ["compareAtPrice"],
};

export const createProductSchema = productFields.refine(
  compareAtIsHigher,
  compareAtIssue,
);

export const updateProductSchema = productFields
  .partial()
  .refine((values) => Object.keys(values).length > 0, "Nada para actualizar")
  .refine(compareAtIsHigher, compareAtIssue);

export const productIdSchema = z.uuid("Identificador inválido");

// Formulario: mismos campos, precios en SOLES con decimales. `toCents` los
// convierte en el service, que es el borde donde el formulario deja de serlo.
const soles = z
  .number("Ingresá un precio válido")
  .min(0, "El precio no puede ser negativo")
  .max(1_000_000, "El precio es demasiado alto");

export const productFormSchema = productFields
  .extend({ price: soles, compareAtPrice: soles.nullish() })
  .refine(compareAtIsHigher, compareAtIssue);

// Query pública del storefront. Todo llega como string desde la URL: `stringbool`
// en vez de `coerce.boolean()`, que convierte "false" en `true`.
export const publicProductQuerySchema = z.object({
  featured: z.stringbool().optional(),
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Categoría inválida")
    .optional(),
  search: z
    .string()
    .trim()
    .max(80, "La búsqueda no puede superar los 80 caracteres")
    .optional(),
  // `relevance` es el orden histórico (destacados primero, después alfabético):
  // es el default para que quien no mande `sort` vea lo de siempre.
  sort: z.enum(["relevance", "price-asc", "price-desc"]).default("relevance"),
  limit: z.coerce
    .number()
    .int("El límite debe ser un entero")
    .min(1, "El límite mínimo es 1")
    .max(48, "El límite máximo es 48")
    .default(12),
  // `.catch(1)` y no `.default(1)`: cubre ausente y basura (`?page=abc`, `?page=-1`)
  // en el mismo lugar. Con `.default` un valor torcido rompería el parseo entero
  // de la URL y se perderían de paso `category`/`search`.
  page: z.coerce.number().int().min(1).catch(1),
});

export type PublicProductQuery = z.infer<typeof publicProductQuerySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFormValues = z.infer<typeof productFormSchema>;
