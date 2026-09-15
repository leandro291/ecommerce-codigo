import assert from "node:assert/strict";
import { test } from "node:test";

import { actionLabel, groupByResource, resourceLabel } from "../permission-groups.ts";
import { PERMISSIONS } from "../../../../lib/rbac-catalog.ts";
import type { Permission } from "@/modules/roles/types/role";

function permission(overrides: Partial<Permission>): Permission {
  return {
    id: "id",
    code: "products.read",
    resource: "products",
    action: "read",
    description: null,
    createdAt: new Date(),
    ...overrides,
  };
}

test("resourceLabel traduce un recurso conocido y humaniza uno desconocido", () => {
  assert.equal(resourceLabel("products"), "Productos");
  assert.equal(resourceLabel("shipping_zones"), "shipping zones");
});

test("actionLabel traduce una acción conocida y humaniza una desconocida", () => {
  assert.equal(actionLabel("update_status"), "cambiar estado");
  assert.equal(actionLabel("archive_all"), "archive all");
});

test("groupByResource agrupa permisos por recurso conservando el orden de entrada", () => {
  const permissions = [
    permission({ code: "products.read", resource: "products", action: "read" }),
    permission({ code: "orders.read", resource: "orders", action: "read" }),
    permission({ code: "products.create", resource: "products", action: "create" }),
  ];

  const groups = groupByResource(permissions);

  assert.deepEqual(
    groups.map((g) => g.resource),
    ["products", "orders"],
  );
  assert.equal(groups[0].permissions.length, 2);
  assert.equal(groups[0].label, "Productos");
});

test("groupByResource con una lista vacía da []", () => {
  assert.deepEqual(groupByResource([]), []);
});

test("resourceLabel y actionLabel reemplazan todos los guiones bajos, no solo el primero", () => {
  assert.equal(resourceLabel("gift_card_codes"), "gift card codes");
  assert.equal(actionLabel("bulk_update_status"), "bulk update status");
});

test("todo recurso y acción del catálogo RBAC tiene etiqueta de negocio (no cae al fallback)", () => {
  for (const { code } of PERMISSIONS) {
    const [resource, action] = code.split(".");
    assert.notEqual(resourceLabel(resource), resource.replace(/_/g, " "), code);
    assert.notEqual(actionLabel(action), action.replace(/_/g, " "), code);
  }
});

test("groupByResource usa el recurso humanizado como label de un grupo desconocido", () => {
  const [group] = groupByResource([
    permission({ code: "shipping_zones.read", resource: "shipping_zones", action: "read" }),
  ]);
  assert.equal(group.resource, "shipping_zones");
  assert.equal(group.label, "shipping zones");
});

test("groupByResource conserva el orden de los permisos dentro de cada grupo y no muta la entrada", () => {
  const permissions = [
    permission({ code: "users.update", resource: "users", action: "update" }),
    permission({ code: "roles.read", resource: "roles", action: "read" }),
    permission({ code: "users.read", resource: "users", action: "read" }),
  ];
  const snapshot = [...permissions];

  const groups = groupByResource(permissions);

  assert.deepEqual(
    groups[0].permissions.map((p) => p.code),
    ["users.update", "users.read"],
  );
  assert.deepEqual(permissions, snapshot);
});
