import assert from "node:assert/strict";
import { test } from "node:test";

import { stripSensitive } from "../audit.ts";

test("stripSensitive redacta una clave sensible directa (password, token)", () => {
  const result = stripSensitive({ password: "hunter2", apiToken: "abc" }) as Record<
    string,
    unknown
  >;
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.apiToken, "[REDACTED]");
});

test("stripSensitive redacta claves sensibles dentro de objetos y arrays anidados", () => {
  const result = stripSensitive({
    nested: [{ clientSecret: "shh", ok: 1 }],
  }) as Record<string, unknown>;
  assert.deepEqual(result.nested, [{ clientSecret: "[REDACTED]", ok: 1 }]);
});

test("stripSensitive no toca claves cuyo nombre solo contiene el término como subcadena (shippingAddress)", () => {
  const result = stripSensitive({
    shippingAddress: "Av. Siempreviva 742",
  }) as Record<string, unknown>;
  assert.equal(result.shippingAddress, "Av. Siempreviva 742");
});

test("stripSensitive redacta segmentos cortos exactos (pin, cvv, ssn, jwt)", () => {
  const result = stripSensitive({
    pin: "1234",
    cvv: "999",
    ssn: "123-45-6789",
    jwt: "ey.J.x",
  }) as Record<string, unknown>;
  assert.equal(result.pin, "[REDACTED]");
  assert.equal(result.cvv, "[REDACTED]");
  assert.equal(result.ssn, "[REDACTED]");
  assert.equal(result.jwt, "[REDACTED]");
});

test("stripSensitive deja pasar un Date sin tocarlo", () => {
  const date = new Date("2026-01-01T00:00:00.000Z");
  const result = stripSensitive({ createdAt: date }) as Record<string, unknown>;
  assert.equal(result.createdAt, date);
});

test("stripSensitive devuelve primitivos y null tal cual", () => {
  assert.equal(stripSensitive("texto"), "texto");
  assert.equal(stripSensitive(0), 0);
  assert.equal(stripSensitive(null), null);
  assert.equal(stripSensitive(undefined), undefined);
});

test("stripSensitive redacta dentro de un array en la raíz y de arrays anidados", () => {
  assert.deepEqual(stripSensitive([[{ accessToken: "x", id: 1 }], "ok"]), [
    [{ accessToken: "[REDACTED]", id: 1 }],
    "ok",
  ]);
});

test("stripSensitive redacta la clave sensible entera aunque su valor sea un objeto", () => {
  const result = stripSensitive({
    credentials: { user: "ana@example.com", pass: "x" },
  }) as Record<string, unknown>;
  assert.equal(result.credentials, "[REDACTED]");
});

test("stripSensitive reconoce variantes de nombre (api_key, API-KEY, privateKey, Authorization, sessionId, cookie)", () => {
  const result = stripSensitive({
    api_key: "1",
    "API-KEY": "2",
    privateKey: "3",
    Authorization: "4",
    sessionId: "5",
    cookie: "6",
  });
  assert.deepEqual(result, {
    api_key: "[REDACTED]",
    "API-KEY": "[REDACTED]",
    privateKey: "[REDACTED]",
    Authorization: "[REDACTED]",
    sessionId: "[REDACTED]",
    cookie: "[REDACTED]",
  });
});

test("stripSensitive redacta segmentos cortos dentro de claves camelCase y snake_case (userPin, card_cvv, PIN_CODE)", () => {
  const result = stripSensitive({ userPin: "1", card_cvv: "2", PIN_CODE: "3" });
  assert.deepEqual(result, {
    userPin: "[REDACTED]",
    card_cvv: "[REDACTED]",
    PIN_CODE: "[REDACTED]",
  });
});

test("stripSensitive no redacta claves donde el término corto es parte de otra palabra (pinned, spinner)", () => {
  const result = stripSensitive({ pinned: true, spinner: "on" });
  assert.deepEqual(result, { pinned: true, spinner: "on" });
});

test("stripSensitive no muta el objeto original", () => {
  const original = { password: "hunter2", nested: { token: "abc" } };
  stripSensitive(original);
  assert.deepEqual(original, { password: "hunter2", nested: { token: "abc" } });
});
