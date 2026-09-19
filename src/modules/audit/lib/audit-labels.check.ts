import assert from "node:assert/strict";

import { parseCursor } from "@/lib/cursor";

import type { AuditLogRow } from "../types/audit-log";
import { actionLabel, describeChange } from "./audit-labels";

// --- Cursor ----------------------------------------------------------------

const ID = "9f6c2f28-1b7a-4c9e-8a51-2f0f6d3a7b11";
const CREATED_AT = "2026-01-31T22:15:00.000Z";

const cursor = parseCursor(`${CREATED_AT}|${ID}`);

assert.equal(cursor.id, ID);
assert.equal(cursor.createdAt.toISOString(), CREATED_AT);

// Ida y vuelta: es exactamente lo que arma el repositorio con la última fila.
assert.deepEqual(
  parseCursor(`${cursor.createdAt.toISOString()}|${cursor.id}`),
  cursor,
);

for (const invalid of [
  `${CREATED_AT}|${ID}|extra`, // segmentos de más
  "basura",
  `${CREATED_AT}`, // sin id
  `${CREATED_AT}|no-es-uuid`,
  `31/01/2026|${ID}`, // fecha no ISO
  `2026-99-99T00:00:00.000Z|${ID}`, // forma ISO, mes/día imposibles
  "",
]) {
  assert.throws(() => parseCursor(invalid), `debería rechazar: ${invalid}`);
}

// Documentado, no accidental: una fecha ISO que no existe rueda al día
// siguiente (`Date` de JS) en vez de tirar. El cursor lo emite el servidor y
// pagina hacia atrás, así que rodar un par de días no filtra nada.
assert.equal(
  parseCursor(`2026-02-31T00:00:00.000Z|${ID}`).createdAt.toISOString(),
  "2026-03-03T00:00:00.000Z",
);

// --- Etiquetas y frase de la fila expandida --------------------------------

function row(overrides: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: ID,
    actorId: null,
    action: "user.created",
    entityType: "user",
    entityId: null,
    changes: null,
    metadata: null,
    severity: "info",
    createdAt: new Date(CREATED_AT),
    actor: null,
    ...overrides,
  };
}

// AC7: descripción del permiso y nombre del puesto, nunca el code ni el slug.
const revoked = describeChange(
  row({
    action: "role.permission_revoked",
    entityType: "role",
    changes: { before: { permissionCode: "products.delete" } },
    metadata: { roleSlug: "manager", source: "admin-panel" },
    severity: "warning",
  }),
);

assert.equal(
  revoked,
  "Se quitó el permiso «Eliminar productos» del puesto «Encargado»",
);
assert.doesNotMatch(revoked, /products\.delete|manager/);

const granted = describeChange(
  row({
    action: "role.permission_granted",
    entityType: "role",
    changes: { after: { permissionCode: "audit_logs.read" } },
    metadata: { roleSlug: "audit" },
  }),
);

assert.equal(
  granted,
  "Se dio el permiso «Ver la bitácora de auditoría» al puesto «Auditoría»",
);

assert.equal(
  describeChange(row({ action: "role.assigned", metadata: { roleSlug: "employee" } })),
  "Se asignó el puesto «Empleado»",
);

// Sin `metadata`: no se inventa un puesto y la oración sigue leyéndose.
assert.equal(describeChange(row({ action: "role.revoked" })), "Se quitó un puesto");

// AC8: acción desconocida → cadena cruda, sin romper.
assert.equal(actionLabel("product.updated"), "product.updated");
assert.equal(
  describeChange(row({ action: "product.updated", entityType: "product" })),
  "product.updated",
);

console.log("audit: ok — cursor y etiquetas");
