import assert from "node:assert/strict";
import { test } from "node:test";

import { fillDays } from "../revenue-series.ts";

test("fillDays rellena los huecos con revenue 0 y mantiene N puntos consecutivos y ordenados", () => {
  const from = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01
  const rows = [
    { date: "2026-09-01", revenue: 1000 },
    { date: "2026-09-03", revenue: 2500 },
  ];

  const result = fillDays(from, 5, rows);

  assert.deepEqual(result, [
    { date: "2026-09-01", revenue: 1000 },
    { date: "2026-09-02", revenue: 0 },
    { date: "2026-09-03", revenue: 2500 },
    { date: "2026-09-04", revenue: 0 },
    { date: "2026-09-05", revenue: 0 },
  ]);
});

test("fillDays devuelve la serie completa aunque no haya ventas en ningún día", () => {
  const from = new Date(Date.UTC(2026, 0, 30)); // 2026-01-30, cruza de mes

  const result = fillDays(from, 3, []);

  assert.deepEqual(
    result.map((point) => point.date),
    ["2026-01-30", "2026-01-31", "2026-02-01"],
  );
  assert.ok(result.every((point) => point.revenue === 0));
});

test("fillDays con days=1 devuelve un solo punto, el de 'from'", () => {
  const from = new Date(Date.UTC(2026, 8, 16));

  const result = fillDays(from, 1, [{ date: "2026-09-16", revenue: 500 }]);

  assert.deepEqual(result, [{ date: "2026-09-16", revenue: 500 }]);
});

test("fillDays ignora filas fuera de la ventana [from, from + days)", () => {
  const from = new Date(Date.UTC(2026, 8, 1));

  const result = fillDays(from, 2, [{ date: "2026-09-30", revenue: 999 }]);

  assert.deepEqual(result, [
    { date: "2026-09-01", revenue: 0 },
    { date: "2026-09-02", revenue: 0 },
  ]);
});

test("fillDays no muta el arreglo 'rows' de entrada", () => {
  const from = new Date(Date.UTC(2026, 8, 1));
  const rows = [{ date: "2026-09-01", revenue: 1000 }];
  const snapshot = JSON.parse(JSON.stringify(rows));

  fillDays(from, 3, rows);

  assert.deepEqual(rows, snapshot);
});
