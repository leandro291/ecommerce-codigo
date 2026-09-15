import assert from "node:assert/strict";
import { test } from "node:test";

import { generateTemporaryPassword } from "../password.ts";

test("generateTemporaryPassword devuelve 16 caracteres", () => {
  assert.equal(generateTemporaryPassword().length, 16);
});

test("generateTemporaryPassword incluye al menos una minúscula, una mayúscula, un dígito y un símbolo", () => {
  const password = generateTemporaryPassword();
  assert.match(password, /[a-km-z]/);
  assert.match(password, /[A-HJ-NP-Z]/);
  assert.match(password, /[2-9]/);
  assert.match(password, /[!@#$%*?_-]/);
});

test("generateTemporaryPassword no usa caracteres ambiguos (0, O, 1, l, I)", () => {
  const password = generateTemporaryPassword();
  assert.doesNotMatch(password, /[0O1lI]/);
});

test("generateTemporaryPassword no repite la misma contraseña en llamadas sucesivas", () => {
  assert.notEqual(generateTemporaryPassword(), generateTemporaryPassword());
});

// Una sola muestra no prueba una garantía: el sorteo podría haber acertado.
test("generateTemporaryPassword garantiza las 4 clases y solo usa el alfabeto permitido en 500 generaciones", () => {
  for (let i = 0; i < 500; i++) {
    const password = generateTemporaryPassword();
    assert.match(password, /^[a-km-zA-HJ-NP-Z2-9!@#$%*?_-]{16}$/);
    assert.match(password, /[a-km-z]/);
    assert.match(password, /[A-HJ-NP-Z]/);
    assert.match(password, /[2-9]/);
    assert.match(password, /[!@#$%*?_-]/);
  }
});
