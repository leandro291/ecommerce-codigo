import assert from "node:assert/strict";
import { test } from "node:test";

import { actionLabel, describeChange, entityLabel } from "../audit-labels.ts";
import type { AuditLogRow } from "@/modules/audit/types/audit-log";

function row(overrides: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: "id",
    actorId: null,
    action: "user.created",
    entityType: "user",
    entityId: null,
    changes: null,
    metadata: null,
    severity: "info",
    createdAt: new Date(),
    actor: null,
    ...overrides,
  };
}

test("actionLabel traduce un código conocido", () => {
  assert.equal(actionLabel("user.created"), "Alta de persona");
});

test("actionLabel devuelve el código crudo si no está en el mapa", () => {
  assert.equal(actionLabel("foo.bar"), "foo.bar");
});

test("entityLabel traduce un tipo conocido y cae al valor crudo si no lo conoce", () => {
  assert.equal(entityLabel("user"), "Persona");
  assert.equal(entityLabel("widget"), "widget");
});

test("describeChange arma la frase de user.created con y sin roleSlug", () => {
  assert.equal(
    describeChange(row({ action: "user.created", metadata: { roleSlug: "manager" } })),
    "Se dio de alta una persona con el puesto «Encargado»",
  );
  assert.equal(
    describeChange(row({ action: "user.created", metadata: null })),
    "Se dio de alta una persona",
  );
});

test("describeChange arma la frase de role.permission_granted/revoked con y sin permissionCode", () => {
  assert.equal(
    describeChange(
      row({
        action: "role.permission_granted",
        metadata: { roleSlug: "manager" },
        changes: { after: { permissionCode: "products.delete" } },
      }),
    ),
    "Se dio el permiso «Eliminar productos» al puesto «Encargado»",
  );
  assert.equal(
    describeChange(row({ action: "role.permission_revoked", metadata: null, changes: null })),
    "Se quitó un permiso de un puesto",
  );
});

test("describeChange arma la frase de user.deleted aunque traiga roleSlug", () => {
  assert.equal(
    describeChange(row({ action: "user.deleted", metadata: { roleSlug: "manager" } })),
    "Se dio de baja una persona",
  );
});

test("describeChange arma role.assigned y role.revoked con y sin roleSlug", () => {
  assert.equal(
    describeChange(row({ action: "role.assigned", metadata: { roleSlug: "manager" } })),
    "Se asignó el puesto «Encargado»",
  );
  assert.equal(describeChange(row({ action: "role.assigned" })), "Se asignó un puesto");
  assert.equal(
    describeChange(row({ action: "role.revoked", metadata: { roleSlug: "manager" } })),
    "Se quitó el puesto «Encargado»",
  );
  assert.equal(describeChange(row({ action: "role.revoked" })), "Se quitó un puesto");
});

test("describeChange trata un roleSlug vacío o no string como ausente", () => {
  assert.equal(
    describeChange(row({ action: "role.assigned", metadata: { roleSlug: "" } })),
    "Se asignó un puesto",
  );
  assert.equal(
    describeChange(row({ action: "role.assigned", metadata: { roleSlug: 42 } })),
    "Se asignó un puesto",
  );
});

test("describeChange toma el permissionCode de changes.before si no hay after", () => {
  assert.equal(
    describeChange(
      row({
        action: "role.permission_revoked",
        metadata: { roleSlug: "manager" },
        changes: { before: { permissionCode: "products.delete" } },
      }),
    ),
    "Se quitó el permiso «Eliminar productos» del puesto «Encargado»",
  );
});

test("describeChange muestra el slug y el code crudos si el catálogo no los conoce", () => {
  assert.equal(
    describeChange(
      row({
        action: "role.permission_granted",
        metadata: { roleSlug: "desconocido" },
        changes: { after: { permissionCode: "foo.bar" } },
      }),
    ),
    "Se dio el permiso «foo.bar» al puesto «desconocido»",
  );
});

test("describeChange cae a actionLabel para una acción sin caso propio", () => {
  assert.equal(describeChange(row({ action: "order.paid" })), "Pedido pagado");
  assert.equal(describeChange(row({ action: "foo.bar" })), "foo.bar");
});
