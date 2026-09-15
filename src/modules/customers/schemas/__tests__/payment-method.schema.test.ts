import assert from "node:assert/strict";
import { test } from "node:test";

import { paymentMethodIdParamSchema } from "../payment-method.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

test("paymentMethodIdParamSchema acepta un id uuid válido", () => {
  const result = paymentMethodIdParamSchema.safeParse({ id: UUID });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { id: UUID });
});

test("paymentMethodIdParamSchema acepta un uuid en mayúsculas", () => {
  assert.equal(
    paymentMethodIdParamSchema.safeParse({ id: UUID.toUpperCase() }).success,
    true,
  );
});

test("paymentMethodIdParamSchema rechaza la falta de id", () => {
  assert.equal(paymentMethodIdParamSchema.safeParse({}).success, false);
});

test("paymentMethodIdParamSchema rechaza id vacío, texto y uuid truncado", () => {
  for (const id of ["", "abc", UUID.slice(0, -1)]) {
    assert.equal(paymentMethodIdParamSchema.safeParse({ id }).success, false, id);
  }
});

test("paymentMethodIdParamSchema rechaza el id de Stripe (pm_…): el param es el id interno", () => {
  assert.equal(
    paymentMethodIdParamSchema.safeParse({ id: "pm_card_visa" }).success,
    false,
  );
});

test("paymentMethodIdParamSchema no recorta espacios alrededor del uuid", () => {
  assert.equal(
    paymentMethodIdParamSchema.safeParse({ id: ` ${UUID} ` }).success,
    false,
  );
});

test("paymentMethodIdParamSchema no coerciona un id no string", () => {
  assert.equal(paymentMethodIdParamSchema.safeParse({ id: 123 }).success, false);
});

test("paymentMethodIdParamSchema descarta claves desconocidas", () => {
  const result = paymentMethodIdParamSchema.safeParse({ id: UUID, extra: "x" });
  assert.deepEqual(result.data, { id: UUID });
});
