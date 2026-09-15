import assert from "node:assert/strict";
import { test } from "node:test";

import { orderIdSchema, orderRangeQuerySchema } from "../order.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

function firstIssue(result: {
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}) {
  return result.error?.issues[0];
}

test("orderRangeQuerySchema acepta query vacía sin inventar defaults", () => {
  const result = orderRangeQuerySchema.safeParse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {});
});

test("orderRangeQuerySchema acepta un rango completo con strings de searchParams", () => {
  const result = orderRangeQuerySchema.safeParse({
    from: "2026-09-01",
    to: "2026-09-14",
    tzOffset: "300",
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    from: "2026-09-01",
    to: "2026-09-14",
    tzOffset: 300,
  });
});

test("orderRangeQuerySchema acepta solo uno de los extremos del rango", () => {
  assert.equal(orderRangeQuerySchema.safeParse({ from: "2026-09-01" }).success, true);
  assert.equal(orderRangeQuerySchema.safeParse({ to: "2026-09-01" }).success, true);
});

test("orderRangeQuerySchema rechaza fechas con formato distinto de YYYY-MM-DD", () => {
  for (const from of ["", "2026-9-1", "01/09/2026", "2026-09-01T00:00:00Z", "hoy"]) {
    assert.equal(orderRangeQuerySchema.safeParse({ from }).success, false, from);
  }
});

test("orderRangeQuerySchema rechaza fechas inexistentes del calendario", () => {
  for (const to of ["2026-13-01", "2026-02-30", "2025-02-29"]) {
    assert.equal(orderRangeQuerySchema.safeParse({ to }).success, false, to);
  }
  assert.equal(orderRangeQuerySchema.safeParse({ to: "2028-02-29" }).success, true);
});

test("orderRangeQuerySchema acepta desde igual a hasta (un solo día)", () => {
  assert.equal(
    orderRangeQuerySchema.safeParse({ from: "2026-09-14", to: "2026-09-14" }).success,
    true,
  );
});

test("orderRangeQuerySchema rechaza desde posterior a hasta con el issue en 'from'", () => {
  const result = orderRangeQuerySchema.safeParse({
    from: "2026-09-15",
    to: "2026-09-14",
  });
  assert.equal(result.success, false);
  assert.equal(firstIssue(result)?.message, "«Desde» no puede ser posterior a «hasta»");
  assert.deepEqual(firstIssue(result)?.path, ["from"]);
});

test("orderRangeQuerySchema compara el rango cronológicamente entre meses y años", () => {
  assert.equal(
    orderRangeQuerySchema.safeParse({ from: "2025-12-31", to: "2026-01-01" }).success,
    true,
  );
  assert.equal(
    orderRangeQuerySchema.safeParse({ from: "2026-10-01", to: "2026-09-30" }).success,
    false,
  );
});

test("orderRangeQuerySchema acepta tzOffset en los límites -840 y 840 y rechaza fuera", () => {
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: -840 }).data?.tzOffset, -840);
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: "840" }).data?.tzOffset, 840);
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: -841 }).success, false);
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: "841" }).success, false);
});

test("orderRangeQuerySchema rechaza tzOffset decimal o no numérico", () => {
  for (const tzOffset of ["90.5", "abc", 1.5]) {
    assert.equal(orderRangeQuerySchema.safeParse({ tzOffset }).success, false, String(tzOffset));
  }
});

test("orderRangeQuerySchema coerciona tzOffset negativo desde string", () => {
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: "-330" }).data?.tzOffset, -330);
});

// `?tzOffset=` llega como "" y `z.coerce.number` lo vuelve 0: equivale al
// fallback UTC del handler, así que no rompe nada.
test("orderRangeQuerySchema coerciona tzOffset vacío a 0", () => {
  assert.equal(orderRangeQuerySchema.safeParse({ tzOffset: "" }).data?.tzOffset, 0);
});

test("orderIdSchema acepta un uuid válido", () => {
  assert.equal(orderIdSchema.safeParse(UUID).success, true);
});

test("orderIdSchema rechaza vacío, texto, uuid truncado y no-string", () => {
  for (const value of ["", "abc", UUID.slice(0, -1), 123, null]) {
    assert.equal(orderIdSchema.safeParse(value).success, false, String(value));
  }
});
