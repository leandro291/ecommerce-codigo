import assert from "node:assert/strict";
import { test } from "node:test";

import type { ProductFormValues } from "../../schemas/product.schema.ts";
import { toPayload } from "../product.service.ts";

const form: ProductFormValues = {
  name: "Laptop Aero",
  categoryId: "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a",
  price: 19.99,
};

test("toPayload convierte price de soles a céntimos enteros sin error de flotante", () => {
  assert.equal(toPayload(form).price, 1999);
});

test("toPayload convierte compareAtPrice de soles a céntimos", () => {
  assert.equal(toPayload({ ...form, compareAtPrice: 24.5 }).compareAtPrice, 2450);
});

test("toPayload conserva compareAtPrice null y undefined sin convertirlos a 0", () => {
  assert.equal(toPayload({ ...form, compareAtPrice: null }).compareAtPrice, null);
  assert.equal(toPayload(form).compareAtPrice, undefined);
});

test("toPayload convierte precio 0 a 0 céntimos", () => {
  const result = toPayload({ ...form, price: 0, compareAtPrice: 0 });
  assert.equal(result.price, 0);
  assert.equal(result.compareAtPrice, 0);
});

test("toPayload deja intactos los demás campos", () => {
  const input: ProductFormValues = { ...form, slug: "laptop-aero", stock: 4, isActive: true };
  assert.deepEqual(toPayload(input), { ...input, price: 1999, compareAtPrice: undefined });
});
