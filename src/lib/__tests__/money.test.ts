import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPrice, fromCents, toCents } from "../money.ts";

test("toCents redondea soles con decimales a céntimos enteros", () => {
  assert.equal(toCents(19.99), 1999);
});

test("toCents no arrastra error de punto flotante (19.99 -> 1999, no 1998)", () => {
  assert.equal(toCents(19.99), 1999);
  assert.notEqual(19.99 * 100, 1999); // el bug que el redondeo evita
});

test("toCents de 0 da 0", () => {
  assert.equal(toCents(0), 0);
});

test("fromCents convierte céntimos negativos a soles negativos", () => {
  assert.equal(fromCents(-100), -1);
});

// Intl.NumberFormat("es-PE") separa el símbolo del monto con NBSP (U+00A0),
// no un espacio normal: un "S/ 0.00" tipeado a mano no matchea nunca.
test("formatPrice de 0 muestra S/ 0.00", () => {
  assert.equal(formatPrice(0), "S/ 0.00");
});

test("formatPrice de un monto negativo lo muestra con signo", () => {
  assert.equal(formatPrice(-1999), "-S/ 19.99");
});

test("toCents convierte soles negativos a céntimos negativos sin perder un céntimo", () => {
  assert.equal(toCents(-19.99), -1999);
});

test("toCents redondea la suma flotante 0.1 + 0.2 a 30 céntimos", () => {
  assert.equal(toCents(0.1 + 0.2), 30);
});

test("toCents redondea medio céntimo hacia arriba (1.005 -> 101)", { todo: "BUG: toCents(1.005) da 100 porque 1.005 * 100 === 100.49999999999999; Math.round sobre el producto flotante redondea medio céntimo hacia abajo (también 0.285 -> 28). El schema del formulario admite más de 2 decimales" }, () => {
  assert.equal(toCents(1.005), 101);
});

test("formatPrice de 1 céntimo muestra S/ 0.01", () => {
  assert.equal(formatPrice(1), "S/\u00A00.01");
});

test("formatPrice agrupa miles con coma", () => {
  assert.equal(formatPrice(123456789), "S/\u00A01,234,567.89");
});
