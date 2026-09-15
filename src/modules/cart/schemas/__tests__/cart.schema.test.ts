import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_QUANTITY,
  addToCartSchema,
  productIdSchema,
  setQuantitySchema,
} from "../cart.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

test("MAX_QUANTITY es 99", () => {
  assert.equal(MAX_QUANTITY, 99);
});

test("productIdSchema acepta un uuid válido", () => {
  assert.equal(productIdSchema.safeParse(UUID).success, true);
});

test("productIdSchema rechaza vacío, texto libre y uuid truncado con el mensaje 'Producto inválido'", () => {
  for (const value of ["", "abc", UUID.slice(0, -1)]) {
    const result = productIdSchema.safeParse(value);
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, "Producto inválido");
  }
});

test("productIdSchema rechaza un número en vez de string", () => {
  assert.equal(productIdSchema.safeParse(123).success, false);
});

test("addToCartSchema aplica quantity 1 por defecto si no se envía", () => {
  const result = addToCartSchema.safeParse({ productId: UUID });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { productId: UUID, quantity: 1 });
});

test("addToCartSchema acepta los límites 1 y 99", () => {
  assert.equal(
    addToCartSchema.safeParse({ productId: UUID, quantity: 1 }).data?.quantity,
    1,
  );
  assert.equal(
    addToCartSchema.safeParse({ productId: UUID, quantity: 99 }).data?.quantity,
    99,
  );
});

test("addToCartSchema rechaza quantity 0 y 100", () => {
  assert.equal(
    addToCartSchema.safeParse({ productId: UUID, quantity: 0 }).success,
    false,
  );
  assert.equal(
    addToCartSchema.safeParse({ productId: UUID, quantity: 100 }).success,
    false,
  );
});

test("addToCartSchema rechaza productId ausente", () => {
  assert.equal(addToCartSchema.safeParse({ quantity: 1 }).success, false);
});

test("setQuantitySchema acepta los límites 1 y 99", () => {
  assert.equal(setQuantitySchema.safeParse({ quantity: 1 }).success, true);
  assert.equal(setQuantitySchema.safeParse({ quantity: 99 }).success, true);
});

test("setQuantitySchema rechaza 0 con 'La cantidad mínima es 1' (quitar va por DELETE)", () => {
  const result = setQuantitySchema.safeParse({ quantity: 0 });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "La cantidad mínima es 1");
});

test("setQuantitySchema rechaza negativos", () => {
  assert.equal(setQuantitySchema.safeParse({ quantity: -1 }).success, false);
});

test("setQuantitySchema rechaza 100 con 'La cantidad máxima es 99'", () => {
  const result = setQuantitySchema.safeParse({ quantity: 100 });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "La cantidad máxima es 99");
});

test("setQuantitySchema rechaza decimales con 'La cantidad debe ser un número entero'", () => {
  const result = setQuantitySchema.safeParse({ quantity: 1.5 });
  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues[0]?.message,
    "La cantidad debe ser un número entero",
  );
});

test("setQuantitySchema no coerciona strings: '2' es inválido", () => {
  assert.equal(setQuantitySchema.safeParse({ quantity: "2" }).success, false);
});

test("setQuantitySchema no tiene default: quantity ausente es inválido", () => {
  assert.equal(setQuantitySchema.safeParse({}).success, false);
});

test("setQuantitySchema rechaza NaN e Infinity", () => {
  assert.equal(setQuantitySchema.safeParse({ quantity: NaN }).success, false);
  assert.equal(
    setQuantitySchema.safeParse({ quantity: Infinity }).success,
    false,
  );
});
