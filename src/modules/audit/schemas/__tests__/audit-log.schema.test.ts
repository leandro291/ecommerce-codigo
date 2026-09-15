import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditSeveritySchema,
  listAuditLogsQuerySchema,
} from "../audit-log.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";

function parse(input: Record<string, string>) {
  return listAuditLogsQuerySchema.safeParse(input);
}

test("auditSeveritySchema acepta info, warning y error", () => {
  for (const value of ["info", "warning", "error"]) {
    assert.equal(auditSeveritySchema.safeParse(value).success, true);
  }
});

test("auditSeveritySchema rechaza una severidad desconocida o vacía", () => {
  assert.equal(auditSeveritySchema.safeParse("critical").success, false);
  assert.equal(auditSeveritySchema.safeParse("").success, false);
});

test("query vacía es válida y aplica limit 50 por defecto", () => {
  const result = parse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { limit: 50 });
});

test("limit convierte el string de la query string a número", () => {
  assert.equal(parse({ limit: "20" }).data?.limit, 20);
});

test("limit acepta los límites 1 y 100", () => {
  assert.equal(parse({ limit: "1" }).data?.limit, 1);
  assert.equal(parse({ limit: "100" }).data?.limit, 100);
});

test("limit rechaza 0 y 101", () => {
  assert.equal(parse({ limit: "0" }).success, false);
  assert.equal(parse({ limit: "101" }).success, false);
});

test("limit rechaza decimales y texto no numérico", () => {
  assert.equal(parse({ limit: "1.5" }).success, false);
  assert.equal(parse({ limit: "abc" }).success, false);
});

test("action se recorta de espacios", () => {
  assert.equal(parse({ action: "  user.created  " }).data?.action, "user.created");
});

test("action acepta 64 caracteres y rechaza 65", () => {
  assert.equal(parse({ action: "a".repeat(64) }).success, true);
  assert.equal(parse({ action: "a".repeat(65) }).success, false);
});

test("action cuenta el máximo después de recortar espacios", () => {
  assert.equal(parse({ action: ` ${"a".repeat(64)} ` }).success, true);
});

test("action acepta acciones fuera del catálogo (string libre, no enum)", () => {
  assert.equal(parse({ action: "product.updated" }).data?.action, "product.updated");
});

test("entityType acepta 32 caracteres y rechaza 33", () => {
  assert.equal(parse({ entityType: "e".repeat(32) }).success, true);
  assert.equal(parse({ entityType: "e".repeat(33) }).success, false);
});

test('actorId acepta "system" y un uuid', () => {
  assert.equal(parse({ actorId: "system" }).data?.actorId, "system");
  assert.equal(parse({ actorId: UUID }).data?.actorId, UUID);
});

test("actorId rechaza un texto que no es uuid ni system", () => {
  assert.equal(parse({ actorId: "admin" }).success, false);
  assert.equal(parse({ actorId: "System" }).success, false);
});

test("severity rechaza un valor fuera del enum", () => {
  assert.equal(parse({ severity: "warning" }).success, true);
  assert.equal(parse({ severity: "fatal" }).success, false);
});

test("from y to aceptan fechas YYYY-MM-DD", () => {
  const result = parse({ from: "2026-01-01", to: "2026-01-31" });
  assert.equal(result.success, true);
  assert.equal(result.data?.from, "2026-01-01");
  assert.equal(result.data?.to, "2026-01-31");
});

test("from rechaza formato equivocado y fecha con hora", () => {
  assert.equal(parse({ from: "15/01/2026" }).success, false);
  assert.equal(parse({ from: "2026-01-15T10:00:00Z" }).success, false);
});

test("to rechaza un día que no existe (2026-02-30)", () => {
  assert.equal(parse({ to: "2026-02-30" }).success, false);
});

test("cursor válido se transforma en { createdAt: Date, id }", () => {
  const result = parse({ cursor: `2026-01-15T10:30:00.000Z|${UUID}` });
  assert.equal(result.success, true);
  assert.equal(result.data?.cursor?.id, UUID);
  assert.equal(result.data?.cursor?.createdAt.toISOString(), "2026-01-15T10:30:00.000Z");
});

test('cursor inválido falla con el issue "Cursor inválido" en vez de lanzar', () => {
  const result = parse({ cursor: "basura" });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Cursor inválido");
  assert.deepEqual(result.error?.issues[0]?.path, ["cursor"]);
});

test("cursor vacío es inválido", () => {
  assert.equal(parse({ cursor: "" }).success, false);
});
