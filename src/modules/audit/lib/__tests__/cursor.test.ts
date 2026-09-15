import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCursor } from "../cursor.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

test('parseCursor parsea un cursor válido "<ISO>|<uuid>"', () => {
  const cursor = parseCursor(`2026-01-15T10:30:00.000Z|${UUID}`);
  assert.equal(cursor.id, UUID);
  assert.equal(cursor.createdAt.toISOString(), "2026-01-15T10:30:00.000Z");
});

test("parseCursor rechaza una fecha que no es ISO 8601", () => {
  assert.throws(() => parseCursor(`15/01/2026|${UUID}`));
});

test("parseCursor rechaza un id que no es uuid", () => {
  assert.throws(() => parseCursor("2026-01-15T10:30:00.000Z|no-es-un-uuid"));
});

test("parseCursor rechaza un cursor con segmentos de más", () => {
  assert.throws(() => parseCursor(`2026-01-15T10:30:00.000Z|${UUID}|extra`));
});

test("parseCursor rechaza una fecha inexistente (2026-99-99)", () => {
  assert.throws(() => parseCursor(`2026-99-99T10:30:00.000Z|${UUID}`));
});

test("parseCursor acepta una fecha casi-válida que Date rueda (2026-02-31)", () => {
  const cursor = parseCursor(`2026-02-31T00:00:00.000Z|${UUID}`);
  assert.equal(cursor.createdAt.toISOString(), "2026-03-03T00:00:00.000Z");
});
