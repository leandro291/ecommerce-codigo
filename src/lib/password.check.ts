import assert from "node:assert/strict";

import { generateTemporaryPassword } from "./password";

const SAMPLES = 1000;
const seen = new Set<string>();

for (let i = 0; i < SAMPLES; i++) {
  const password = generateTemporaryPassword();

  assert.equal(password.length, 16, `longitud inesperada: ${password.length}`);
  assert.match(password, /[a-z]/, `sin minúscula: ${password}`);
  assert.match(password, /[A-Z]/, `sin mayúscula: ${password}`);
  assert.match(password, /[0-9]/, `sin dígito: ${password}`);
  assert.match(password, /[!@#$%*?\-_]/, `sin símbolo: ${password}`);
  assert.doesNotMatch(password, /[0O1lI]/, `caracter ambiguo: ${password}`);

  seen.add(password);
}

assert.equal(seen.size, SAMPLES, "hubo contraseñas repetidas");

// Sin barajar, las 4 primeras posiciones tendrían siempre la misma clase.
const firstChars = new Set(
  Array.from({ length: 200 }, () => generateTemporaryPassword()[0]),
);

assert.ok(
  firstChars.size > 10,
  `el primer caracter no está barajado: ${firstChars.size} valores distintos`,
);

console.log(`password: ok — ${SAMPLES} muestras, 16 chars, 4 clases, sin repetidos`);
