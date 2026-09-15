import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createProductSchema,
  productFormSchema,
  productIdSchema,
  publicProductQuerySchema,
  updateProductSchema,
} from "../product.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";
const MAX_CENTS = 100_000_000;

const valid = { name: "Laptop Aero", categoryId: UUID, price: 199_900 };

function firstIssue(result: {
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}) {
  return result.error?.issues[0];
}

// --- createProductSchema ---

test("createProductSchema acepta el mínimo obligatorio sin inventar defaults", () => {
  const result = createProductSchema.safeParse(valid);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, valid);
});

test("createProductSchema acepta un producto completo", () => {
  const input = {
    ...valid,
    slug: "laptop-aero-15",
    description: "Ultraliviana",
    compareAtPrice: 249_900,
    sku: "LAP-001",
    stock: 5,
    imageUrl: "https://cdn.example.com/aero.png",
    isActive: true,
    isFeatured: false,
  };
  const result = createProductSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("createProductSchema exige name, categoryId y price", () => {
  for (const key of ["name", "categoryId", "price"] as const) {
    const input: Record<string, unknown> = { ...valid };
    delete input[key];
    const result = createProductSchema.safeParse(input);
    assert.equal(result.success, false, key);
    assert.deepEqual(firstIssue(result)?.path, [key]);
  }
});

test("createProductSchema recorta name y slug antes de validar longitud", () => {
  const result = createProductSchema.safeParse({
    ...valid,
    name: "  Mouse  ",
    slug: "  mouse-pro  ",
  });
  assert.equal(result.data?.name, "Mouse");
  assert.equal(result.data?.slug, "mouse-pro");
  assert.equal(createProductSchema.safeParse({ ...valid, name: " a " }).success, false);
});

test("createProductSchema valida name entre 2 y 120 caracteres", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, name: "ab" }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, name: "a".repeat(120) }).success, true);
  assert.equal(
    firstIssue(createProductSchema.safeParse({ ...valid, name: "a" }))?.message,
    "El nombre debe tener al menos 2 caracteres",
  );
  assert.equal(
    firstIssue(createProductSchema.safeParse({ ...valid, name: "a".repeat(121) }))?.message,
    "El nombre no puede superar los 120 caracteres",
  );
});

test("createProductSchema acepta slug en kebab-case con dígitos", () => {
  for (const slug of ["ab", "rtx-4090", "a1-b2-c3"]) {
    assert.equal(createProductSchema.safeParse({ ...valid, slug }).success, true, slug);
  }
});

test("createProductSchema rechaza slug con mayúsculas, espacios, guiones sobrantes o tildes", () => {
  for (const slug of ["Laptop", "laptop aero", "-laptop", "laptop-", "laptop--aero", "cámara", "a_b"]) {
    const result = createProductSchema.safeParse({ ...valid, slug });
    assert.equal(result.success, false, slug);
    assert.equal(firstIssue(result)?.message, "Slug inválido", slug);
  }
});

test("createProductSchema valida slug entre 2 y 120 caracteres", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, slug: "a" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...valid, slug: "" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...valid, slug: "a".repeat(120) }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, slug: "a".repeat(121) }).success, false);
});

test("createProductSchema rechaza categoryId que no es uuid", () => {
  const result = createProductSchema.safeParse({ ...valid, categoryId: "laptops" });
  assert.equal(result.success, false);
  assert.equal(firstIssue(result)?.message, "Categoría inválida");
});

test("createProductSchema acepta precio 0 y el tope en céntimos", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, price: 0 }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, price: MAX_CENTS }).success, true);
});

test("createProductSchema rechaza precio negativo, decimal o sobre el tope", () => {
  const cases: [number, string][] = [
    [-1, "El precio no puede ser negativo"],
    [19.99, "El precio debe estar en centavos"],
    [MAX_CENTS + 1, "El precio es demasiado alto"],
  ];
  for (const [price, message] of cases) {
    const result = createProductSchema.safeParse({ ...valid, price });
    assert.equal(result.success, false, String(price));
    assert.equal(firstIssue(result)?.message, message, String(price));
  }
});

test("createProductSchema no coerciona el precio desde string", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, price: "1999" }).success, false);
});

test("createProductSchema rechaza compareAtPrice negativo, decimal o sobre el tope", () => {
  for (const compareAtPrice of [-1, 2000.5, MAX_CENTS + 1]) {
    assert.equal(
      createProductSchema.safeParse({ ...valid, compareAtPrice }).success,
      false,
      String(compareAtPrice),
    );
  }
});

test("createProductSchema acepta compareAtPrice null o ausente", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, compareAtPrice: null }).success, true);
  assert.equal(createProductSchema.safeParse(valid).success, true);
});

test("createProductSchema exige compareAtPrice estrictamente mayor que price, con issue en compareAtPrice", () => {
  assert.equal(
    createProductSchema.safeParse({ ...valid, compareAtPrice: valid.price + 1 }).success,
    true,
  );
  for (const compareAtPrice of [valid.price, valid.price - 1]) {
    const result = createProductSchema.safeParse({ ...valid, compareAtPrice });
    assert.equal(result.success, false, String(compareAtPrice));
    assert.equal(
      firstIssue(result)?.message,
      "El precio comparativo debe ser mayor que el precio",
    );
    assert.deepEqual(firstIssue(result)?.path, ["compareAtPrice"]);
  }
});

test("createProductSchema con price 0 rechaza compareAtPrice 0", () => {
  assert.equal(
    createProductSchema.safeParse({ ...valid, price: 0, compareAtPrice: 0 }).success,
    false,
  );
});

test("createProductSchema acepta stock 0 y rechaza negativo o decimal", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, stock: 0 }).success, true);
  assert.equal(
    firstIssue(createProductSchema.safeParse({ ...valid, stock: -1 }))?.message,
    "El stock no puede ser negativo",
  );
  assert.equal(
    firstIssue(createProductSchema.safeParse({ ...valid, stock: 1.5 }))?.message,
    "El stock debe ser un entero",
  );
});

test("createProductSchema valida sku recortado entre 2 y 60 y acepta null", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, sku: null }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, sku: "  AB  " }).data?.sku, "AB");
  assert.equal(createProductSchema.safeParse({ ...valid, sku: "A" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...valid, sku: "A".repeat(60) }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, sku: "A".repeat(61) }).success, false);
});

test("createProductSchema acepta description vacía o null y rechaza más de 2000 caracteres", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, description: "" }).success, true);
  assert.equal(createProductSchema.safeParse({ ...valid, description: null }).success, true);
  assert.equal(
    createProductSchema.safeParse({ ...valid, description: "a".repeat(2000) }).success,
    true,
  );
  assert.equal(
    createProductSchema.safeParse({ ...valid, description: "a".repeat(2001) }).success,
    false,
  );
});

test("createProductSchema rechaza imageUrl que no es URL", () => {
  const result = createProductSchema.safeParse({ ...valid, imageUrl: "aero.png" });
  assert.equal(result.success, false);
  assert.equal(firstIssue(result)?.message, "URL inválida");
});

test("createProductSchema no coerciona isActive/isFeatured desde string", () => {
  assert.equal(createProductSchema.safeParse({ ...valid, isActive: "true" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...valid, isFeatured: 1 }).success, false);
});

test("createProductSchema descarta claves desconocidas", () => {
  const result = createProductSchema.safeParse({ ...valid, id: UUID, role: "admin" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, valid);
});

// --- updateProductSchema ---

test("updateProductSchema acepta un solo campo", () => {
  const result = updateProductSchema.safeParse({ stock: 3 });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { stock: 3 });
});

test("updateProductSchema rechaza body vacío con 'Nada para actualizar'", () => {
  const result = updateProductSchema.safeParse({});
  assert.equal(result.success, false);
  assert.equal(firstIssue(result)?.message, "Nada para actualizar");
});

test("updateProductSchema rechaza body con solo claves desconocidas", () => {
  assert.equal(updateProductSchema.safeParse({ foo: 1 }).success, false);
});

test("updateProductSchema mantiene las reglas de cada campo", () => {
  assert.equal(updateProductSchema.safeParse({ price: -1 }).success, false);
  assert.equal(updateProductSchema.safeParse({ price: 10.5 }).success, false);
  assert.equal(updateProductSchema.safeParse({ slug: "Mal Slug" }).success, false);
});

// Sin `price` en el PATCH no hay contra qué comparar: se valida contra lo guardado
// en otro lado (§10 del spec 003), no acá.
test("updateProductSchema solo compara compareAtPrice cuando llega price", () => {
  assert.equal(updateProductSchema.safeParse({ compareAtPrice: 1 }).success, true);
  const result = updateProductSchema.safeParse({ price: 500, compareAtPrice: 500 });
  assert.equal(result.success, false);
  assert.deepEqual(firstIssue(result)?.path, ["compareAtPrice"]);
});

test("updateProductSchema permite limpiar compareAtPrice con null junto a price", () => {
  assert.equal(updateProductSchema.safeParse({ price: 500, compareAtPrice: null }).success, true);
});

// --- productFormSchema ---

test("productFormSchema acepta precios en soles con decimales", () => {
  const result = productFormSchema.safeParse({ ...valid, price: 19.99, compareAtPrice: 24.5 });
  assert.equal(result.success, true);
  assert.equal(result.data?.price, 19.99);
});

test("productFormSchema acepta 0 y el tope de 1 000 000 soles y rechaza fuera", () => {
  assert.equal(productFormSchema.safeParse({ ...valid, price: 0 }).success, true);
  assert.equal(productFormSchema.safeParse({ ...valid, price: 1_000_000 }).success, true);
  assert.equal(
    firstIssue(productFormSchema.safeParse({ ...valid, price: 1_000_000.01 }))?.message,
    "El precio es demasiado alto",
  );
  assert.equal(
    firstIssue(productFormSchema.safeParse({ ...valid, price: -0.01 }))?.message,
    "El precio no puede ser negativo",
  );
});

test("productFormSchema rechaza precio NaN o string con 'Ingresá un precio válido'", () => {
  for (const price of [Number.NaN, "19.99"]) {
    const result = productFormSchema.safeParse({ ...valid, price });
    assert.equal(result.success, false, String(price));
    assert.equal(firstIssue(result)?.message, "Ingresá un precio válido", String(price));
  }
});

test("productFormSchema aplica el refine de compareAtPrice mayor que price en soles", () => {
  assert.equal(
    productFormSchema.safeParse({ ...valid, price: 19.99, compareAtPrice: 20 }).success,
    true,
  );
  const result = productFormSchema.safeParse({ ...valid, price: 19.99, compareAtPrice: 19.99 });
  assert.equal(result.success, false);
  assert.deepEqual(firstIssue(result)?.path, ["compareAtPrice"]);
});

// --- productIdSchema ---

test("productIdSchema acepta un uuid válido", () => {
  assert.equal(productIdSchema.safeParse(UUID).success, true);
});

test("productIdSchema rechaza vacío, texto, uuid truncado y no-string", () => {
  for (const value of ["", "abc", UUID.slice(0, -1), 123, null]) {
    const result = productIdSchema.safeParse(value);
    assert.equal(result.success, false, String(value));
    assert.equal(firstIssue(result)?.message, "Identificador inválido", String(value));
  }
});

// --- publicProductQuerySchema ---

test("publicProductQuerySchema aplica defaults a query vacía", () => {
  const result = publicProductQuerySchema.safeParse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sort: "relevance", limit: 12, page: 1 });
});

test("publicProductQuerySchema parsea una query completa con strings de searchParams", () => {
  const result = publicProductQuerySchema.safeParse({
    featured: "true",
    category: "notebooks",
    search: "aero",
    sort: "price-desc",
    limit: "24",
    page: "3",
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    featured: true,
    category: "notebooks",
    search: "aero",
    sort: "price-desc",
    limit: 24,
    page: 3,
  });
});

// `coerce.boolean()` convertiría "false" en true; `stringbool` no.
test('publicProductQuerySchema convierte featured "false" en false', () => {
  assert.equal(publicProductQuerySchema.safeParse({ featured: "false" }).data?.featured, false);
});

test("publicProductQuerySchema rechaza featured que no es un booleano textual", () => {
  assert.equal(publicProductQuerySchema.safeParse({ featured: "quizas" }).success, false);
});

test("publicProductQuerySchema acepta los tres sorts y rechaza otros", () => {
  for (const sort of ["relevance", "price-asc", "price-desc"]) {
    assert.equal(publicProductQuerySchema.safeParse({ sort }).data?.sort, sort);
  }
  for (const sort of ["name", "PRICE-ASC", ""]) {
    assert.equal(publicProductQuerySchema.safeParse({ sort }).success, false, sort);
  }
});

test("publicProductQuerySchema recorta category y exige kebab-case", () => {
  assert.equal(
    publicProductQuerySchema.safeParse({ category: "  notebooks  " }).data?.category,
    "notebooks",
  );
  for (const category of ["", "Notebooks", "note books", "a--b"]) {
    const result = publicProductQuerySchema.safeParse({ category });
    assert.equal(result.success, false, category);
    assert.equal(firstIssue(result)?.message, "Categoría inválida", category);
  }
});

test("publicProductQuerySchema recorta search y acepta hasta 80 caracteres", () => {
  assert.equal(publicProductQuerySchema.safeParse({ search: "  rtx  " }).data?.search, "rtx");
  assert.equal(publicProductQuerySchema.safeParse({ search: "" }).data?.search, "");
  assert.equal(
    publicProductQuerySchema.safeParse({ search: ` ${"a".repeat(80)} ` }).success,
    true,
  );
  assert.equal(
    firstIssue(publicProductQuerySchema.safeParse({ search: "a".repeat(81) }))?.message,
    "La búsqueda no puede superar los 80 caracteres",
  );
});

test("publicProductQuerySchema acepta limit entre 1 y 48", () => {
  assert.equal(publicProductQuerySchema.safeParse({ limit: "1" }).data?.limit, 1);
  assert.equal(publicProductQuerySchema.safeParse({ limit: "48" }).data?.limit, 48);
});

test("publicProductQuerySchema rechaza limit fuera de rango, decimal, no numérico o vacío", () => {
  const cases: [string, string][] = [
    ["0", "El límite mínimo es 1"],
    ["49", "El límite máximo es 48"],
    ["2.5", "El límite debe ser un entero"],
    ["", "El límite mínimo es 1"],
  ];
  for (const [limit, message] of cases) {
    const result = publicProductQuerySchema.safeParse({ limit });
    assert.equal(result.success, false, limit);
    assert.equal(firstIssue(result)?.message, message, limit);
  }
  assert.equal(publicProductQuerySchema.safeParse({ limit: "abc" }).success, false);
});

test("publicProductQuerySchema coerciona page válida desde string", () => {
  assert.equal(publicProductQuerySchema.safeParse({ page: "7" }).data?.page, 7);
});

test("publicProductQuerySchema cae a page 1 ante basura sin romper el resto de la query", () => {
  for (const page of ["abc", "0", "-1", "2.5", ""]) {
    const result = publicProductQuerySchema.safeParse({ page, category: "notebooks" });
    assert.equal(result.success, true, page);
    assert.equal(result.data?.page, 1, page);
    assert.equal(result.data?.category, "notebooks", page);
  }
});
