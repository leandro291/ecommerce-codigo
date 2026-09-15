import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify } from "../slug.ts";

test("slugify quita diacríticos (á, ñ, ü)", () => {
  assert.equal(slugify("Café con Leche & Ñoño"), "cafe-con-leche-nono");
});

test("slugify pasa todo a minúsculas", () => {
  assert.equal(slugify("PRODUCTO"), "producto");
});

test("slugify colapsa espacios y símbolos en un solo guion", () => {
  assert.equal(slugify("  Product   Name!!  "), "product-name");
});

test("slugify quita guiones al inicio y al final", () => {
  assert.equal(slugify("-- ok --"), "ok");
});

test("slugify de un texto vacío da string vacío", () => {
  assert.equal(slugify(""), "");
});

test("slugify conserva los dígitos", () => {
  assert.equal(slugify("iPhone 15 Pro"), "iphone-15-pro");
});

test("slugify de un texto con solo símbolos da string vacío", () => {
  assert.equal(slugify("¡¿!?"), "");
});

test("slugify convierte guiones bajos y puntos en guion", () => {
  assert.equal(slugify("mouse_gamer.v2"), "mouse-gamer-v2");
});
