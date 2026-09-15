import assert from "node:assert/strict";

import { fromCents, toCents } from "./money";

// Los casos que rompen con `Math.trunc(soles * 100)`.
assert.equal(toCents(19.99), 1999);
assert.equal(toCents(1299.99), 129999);
assert.equal(toCents(0.1 + 0.2), 30);
assert.equal(toCents(0), 0);

assert.equal(fromCents(129999), 1299.99);
assert.equal(fromCents(0), 0);

// Ida y vuelta sobre precios con decimales.
for (const soles of [0.01, 1.05, 99.9, 12345.67]) {
  assert.equal(fromCents(toCents(soles)), soles);
}

console.log("money: ok");
