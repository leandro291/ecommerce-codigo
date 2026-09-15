import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoryIdSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../category.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

test("createCategorySchema acepta solo el nombre (resto opcional)", () => {
  const result = createCategorySchema.safeParse({ name: "Laptops" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { name: "Laptops" });
});

test("createCategorySchema acepta un payload completo", () => {
  const input = {
    name: "Laptops",
    slug: "laptops-gamer",
    description: "Portátiles",
    imageUrl: "https://cdn.example.com/laptops.png",
    isActive: true,
    position: 3,
  };
  const result = createCategorySchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("createCategorySchema rechaza la falta de nombre", () => {
  assert.equal(createCategorySchema.safeParse({}).success, false);
});

test("createCategorySchema recorta el nombre antes de validar la longitud", () => {
  const result = createCategorySchema.safeParse({ name: "  a  " });
  assert.equal(result.success, false);
  assert.equal(firstMessage(result), "El nombre debe tener al menos 2 caracteres");
  assert.equal(
    createCategorySchema.safeParse({ name: "  TV  " }).data?.name,
    "TV",
  );
});

test("createCategorySchema acepta nombre de 2 y 80 caracteres y rechaza 81", () => {
  assert.equal(createCategorySchema.safeParse({ name: "ab" }).success, true);
  assert.equal(
    createCategorySchema.safeParse({ name: "a".repeat(80) }).success,
    true,
  );
  const result = createCategorySchema.safeParse({ name: "a".repeat(81) });
  assert.equal(result.success, false);
  assert.equal(
    firstMessage(result),
    "El nombre no puede superar los 80 caracteres",
  );
});

test("createCategorySchema acepta slugs en kebab-case y los recorta", () => {
  for (const slug of ["tv", "laptops-gamer", "usb-c-2024"]) {
    assert.equal(
      createCategorySchema.safeParse({ name: "Laptops", slug }).success,
      true,
    );
  }
  assert.equal(
    createCategorySchema.safeParse({ name: "Laptops", slug: "  tv  " }).data
      ?.slug,
    "tv",
  );
});

test("createCategorySchema rechaza slugs con mayúsculas, espacios, acentos o guiones mal ubicados", () => {
  for (const slug of ["Laptops", "mi slug", "cámaras", "-tv", "tv-", "tv--4k", "tv_4k"]) {
    const result = createCategorySchema.safeParse({ name: "Laptops", slug });
    assert.equal(result.success, false, slug);
    assert.equal(firstMessage(result), "Slug inválido", slug);
  }
});

test("createCategorySchema rechaza slug de 1 carácter y de 81", () => {
  const short = createCategorySchema.safeParse({ name: "Laptops", slug: "a" });
  assert.equal(firstMessage(short), "El slug debe tener al menos 2 caracteres");
  const long = createCategorySchema.safeParse({
    name: "Laptops",
    slug: "a".repeat(81),
  });
  assert.equal(firstMessage(long), "El slug no puede superar los 80 caracteres");
});

test("createCategorySchema acepta descripción null y de 500 caracteres, rechaza 501", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", description: null }).success,
    true,
  );
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", description: "a".repeat(500) })
      .success,
    true,
  );
  const result = createCategorySchema.safeParse({
    name: "TV",
    description: "a".repeat(501),
  });
  assert.equal(
    firstMessage(result),
    "La descripción no puede superar los 500 caracteres",
  );
});

test("createCategorySchema recorta la descripción", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", description: "  hola  " }).data
      ?.description,
    "hola",
  );
});

test("createCategorySchema acepta imageUrl null y rechaza una URL mal formada", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", imageUrl: null }).success,
    true,
  );
  const result = createCategorySchema.safeParse({
    name: "TV",
    imageUrl: "no es url",
  });
  assert.equal(firstMessage(result), "URL inválida");
});

test("createCategorySchema no coerciona isActive desde string", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", isActive: "true" }).success,
    false,
  );
});

test("createCategorySchema acepta posición 0 y rechaza negativa, decimal o string", () => {
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", position: 0 }).success,
    true,
  );
  assert.equal(
    firstMessage(createCategorySchema.safeParse({ name: "TV", position: -1 })),
    "La posición no puede ser negativa",
  );
  assert.equal(
    firstMessage(createCategorySchema.safeParse({ name: "TV", position: 1.5 })),
    "La posición debe ser un entero",
  );
  assert.equal(
    createCategorySchema.safeParse({ name: "TV", position: "1" }).success,
    false,
  );
});

test("updateCategorySchema acepta actualizar un solo campo", () => {
  const result = updateCategorySchema.safeParse({ isActive: false });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { isActive: false });
});

test("updateCategorySchema rechaza un objeto vacío con 'Nada para actualizar'", () => {
  const result = updateCategorySchema.safeParse({});
  assert.equal(result.success, false);
  assert.equal(firstMessage(result), "Nada para actualizar");
});

test("updateCategorySchema rechaza un objeto con solo claves desconocidas", () => {
  const result = updateCategorySchema.safeParse({ foo: "bar" });
  assert.equal(result.success, false);
  assert.equal(firstMessage(result), "Nada para actualizar");
});

test("updateCategorySchema sigue validando los campos enviados", () => {
  assert.equal(updateCategorySchema.safeParse({ name: "a" }).success, false);
  assert.equal(updateCategorySchema.safeParse({ slug: "Mal" }).success, false);
});

test("listCategoriesQuerySchema acepta query vacía", () => {
  const result = listCategoriesQuerySchema.safeParse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {});
});

test("listCategoriesQuerySchema recorta search y rechaza más de 80 caracteres", () => {
  assert.equal(
    listCategoriesQuerySchema.safeParse({ search: "  lap  " }).data?.search,
    "lap",
  );
  assert.equal(
    listCategoriesQuerySchema.safeParse({ search: "a".repeat(80) }).success,
    true,
  );
  assert.equal(
    listCategoriesQuerySchema.safeParse({ search: "a".repeat(81) }).success,
    false,
  );
});

test("listCategoriesQuerySchema acepta active 'true'/'false' y rechaza otros valores", () => {
  for (const active of ["true", "false"]) {
    assert.equal(
      listCategoriesQuerySchema.safeParse({ active }).data?.active,
      active,
    );
  }
  for (const active of ["1", "TRUE", "", true]) {
    assert.equal(
      listCategoriesQuerySchema.safeParse({ active }).success,
      false,
    );
  }
});

test("categoryIdSchema acepta un uuid válido", () => {
  assert.equal(categoryIdSchema.safeParse(UUID).success, true);
});

test("categoryIdSchema rechaza vacío, texto y uuid truncado con 'Identificador inválido'", () => {
  for (const value of ["", "abc", UUID.slice(0, -1)]) {
    const result = categoryIdSchema.safeParse(value);
    assert.equal(result.success, false);
    assert.equal(firstMessage(result), "Identificador inválido");
  }
});
