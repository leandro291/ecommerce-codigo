import assert from "node:assert/strict";
import { test } from "node:test";

import { assignableRoles, can, PERMISSIONS, permissionCodesForRole } from "../rbac-catalog.ts";

test("assignableRoles excluye siempre el rol por defecto (customer)", () => {
  const slugs = assignableRoles(true).map((role) => role.slug);
  assert.ok(!slugs.includes("customer"));
});

test("assignableRoles excluye super_admin/admin cuando canAssignAdmin es false", () => {
  const slugs = assignableRoles(false).map((role) => role.slug);
  assert.deepEqual(slugs.sort(), ["audit", "employee", "manager"]);
});

test("assignableRoles incluye super_admin/admin cuando canAssignAdmin es true", () => {
  const slugs = assignableRoles(true).map((role) => role.slug);
  assert.deepEqual(
    slugs.sort(),
    ["admin", "audit", "employee", "manager", "super_admin"],
  );
});

test('permissionCodesForRole expande "*" a todos los códigos del catálogo', () => {
  assert.deepEqual(
    permissionCodesForRole("super_admin"),
    PERMISSIONS.map((p) => p.code),
  );
});

test("permissionCodesForRole devuelve [] para un rol sin permisos (customer)", () => {
  assert.deepEqual(permissionCodesForRole("customer"), []);
});

test("can devuelve true cuando el set incluye el código", () => {
  assert.equal(can(new Set(["products.read"]), "products.read"), true);
});

test("can devuelve false cuando el set no incluye el código", () => {
  assert.equal(can(new Set(["products.read"]), "products.create"), false);
});

test("can devuelve false con un set vacío", () => {
  assert.equal(can(new Set(), "products.read"), false);
});

test("assignableRoles conserva el orden del catálogo ROLES", () => {
  assert.deepEqual(
    assignableRoles(true).map((role) => role.slug),
    ["super_admin", "admin", "manager", "employee", "audit"],
  );
});
