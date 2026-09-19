import assert from "node:assert/strict";
import { test } from "node:test";

import { fillDays } from "../revenue-series.ts";
import { resolveRange } from "../metrics-range.ts";

// "Ahora" fijo para que el test sea determinista sin fake timers: 2026-09-16
// 14:00 UTC cae en 2026-09-16 en cualquiera de los husos de este archivo, así
// que el "hoy local" es el mismo día calendario en todos los casos.
const NOW = Date.parse("2026-09-16T14:00:00Z");

test("resolveRange en UTC-5 (tzOffset=300): 'to' es el arranque de mañana local, hoy entra completo", () => {
  const range = resolveRange("7d", 300, NOW);

  assert.equal(range.from.toISOString(), "2026-09-10T05:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-09-17T05:00:00.000Z");
  assert.equal(range.calendarFrom.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(range.days, 7);
});

test("resolveRange en UTC+9 (tzOffset=-540, al este de UTC): signo invertido, no corre el marcador de calendario", () => {
  const range = resolveRange("7d", -540, NOW);

  assert.equal(range.from.toISOString(), "2026-09-09T15:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-09-16T15:00:00.000Z");
  // El marcador de calendario no se corre por el offset al este: sigue
  // siendo el mismo día local que en UTC-5 (es la razón de que exista).
  assert.equal(range.calendarFrom.toISOString(), "2026-09-10T00:00:00.000Z");
});

test("resolveRange en UTC (tzOffset=0): comportamiento del AC5, sin desplazar nada", () => {
  const range = resolveRange("7d", 0, NOW);

  assert.equal(range.from.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-09-17T00:00:00.000Z");
  assert.equal(range.calendarFrom.toISOString(), "2026-09-10T00:00:00.000Z");
});

test("resolveRange en UTC+5:45 (tzOffset=-345, Nepal): huso que no es múltiplo de 60 minutos", () => {
  const range = resolveRange("7d", -345, NOW);

  assert.equal(range.from.toISOString(), "2026-09-09T18:15:00.000Z");
  assert.equal(range.to.toISOString(), "2026-09-16T18:15:00.000Z");
  assert.equal(range.calendarFrom.toISOString(), "2026-09-10T00:00:00.000Z");
});

test("resolveRange + fillDays: la ventana produce exactamente 'days' etiquetas y la última es hoy", () => {
  for (const tzOffset of [300, -540, 0, -345]) {
    const range = resolveRange("30d", tzOffset, NOW);
    const series = fillDays(range.calendarFrom, range.days, []);

    assert.equal(series.length, 30, `tzOffset=${tzOffset}: esperaba 30 puntos`);
    assert.equal(
      series.at(-1)?.date,
      "2026-09-16",
      `tzOffset=${tzOffset}: el último punto tiene que ser hoy`,
    );
  }
});
