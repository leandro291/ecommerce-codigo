import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isForeignKeyViolation,
  isUniqueViolation,
  violatedConstraint,
} from "../db-errors.ts";

test("isUniqueViolation da true con código 23505", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
});

test("isUniqueViolation da true si el código viene en error.cause", () => {
  assert.equal(isUniqueViolation({ cause: { code: "23505" } }), true);
});

test("isUniqueViolation da false con otro código o sin código", () => {
  assert.equal(isUniqueViolation({ code: "23503" }), false);
  assert.equal(isUniqueViolation({}), false);
});

test("isForeignKeyViolation da true con 23503 y con 23001", () => {
  assert.equal(isForeignKeyViolation({ code: "23503" }), true);
  assert.equal(isForeignKeyViolation({ code: "23001" }), true);
  assert.equal(isForeignKeyViolation({ code: "23505" }), false);
});

test("violatedConstraint devuelve el nombre del constraint cuando existe", () => {
  assert.equal(
    violatedConstraint({ constraint: "products_sku_key" }),
    "products_sku_key",
  );
});

test("violatedConstraint devuelve undefined si el error no trae constraint", () => {
  assert.equal(violatedConstraint({}), undefined);
});

test("isUniqueViolation da false si el código no es string (número 23505)", () => {
  assert.equal(isUniqueViolation({ code: 23505 }), false);
});

test("isUniqueViolation e isForeignKeyViolation dan false con null, undefined o un string", () => {
  for (const error of [null, undefined, "23505"]) {
    assert.equal(isUniqueViolation(error), false);
    assert.equal(isForeignKeyViolation(error), false);
  }
});

test("el código del error de primer nivel gana sobre el de error.cause", () => {
  const error = { code: "23503", cause: { code: "23505" } };
  assert.equal(isUniqueViolation(error), false);
  assert.equal(isForeignKeyViolation(error), true);
});

test("isForeignKeyViolation da true si el código viene en error.cause", () => {
  assert.equal(isForeignKeyViolation({ cause: { code: "23001" } }), true);
});

test("violatedConstraint lee el constraint desde error.cause", () => {
  assert.equal(
    violatedConstraint({ cause: { constraint: "users_email_key" } }),
    "users_email_key",
  );
});

test("violatedConstraint ignora un constraint que no es string", () => {
  assert.equal(violatedConstraint({ constraint: 42 }), undefined);
});
