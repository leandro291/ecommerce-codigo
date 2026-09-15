import assert from "node:assert/strict";
import { test } from "node:test";

import { PERMISSIONS } from "../../../../lib/rbac-catalog.ts";
import {
  permissionCodeSchema,
  roleIdSchema,
  updateRolePermissionsSchema,
} from "../role.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";
const ALL_CODES = PERMISSIONS.map((permission) => permission.code);

// --- permissionCodeSchema ---

test("permissionCodeSchema acepta cada código del catálogo", () => {
  for (const code of ALL_CODES) {
    assert.equal(permissionCodeSchema.safeParse(code).success, true, code);
  }
});

test("permissionCodeSchema rechaza el comodín '*' del Dueño", () => {
  assert.equal(permissionCodeSchema.safeParse("*").success, false);
});

test("permissionCodeSchema rechaza códigos fuera del catálogo aunque tengan formato válido", () => {
  for (const code of ["roles.delete", "users.impersonate", "products.*", "admin"]) {
    assert.equal(permissionCodeSchema.safeParse(code).success, false, code);
  }
});

test("permissionCodeSchema no recorta ni normaliza mayúsculas", () => {
  for (const code of [" roles.update", "roles.update ", "ROLES.UPDATE", "Roles.Update"]) {
    assert.equal(permissionCodeSchema.safeParse(code).success, false, code);
  }
});

test("permissionCodeSchema rechaza vacío y tipos que no son string", () => {
  for (const value of ["", null, undefined, 1, ["roles.update"], { code: "roles.update" }]) {
    assert.equal(permissionCodeSchema.safeParse(value).success, false, String(value));
  }
});

// --- updateRolePermissionsSchema ---

test("updateRolePermissionsSchema acepta una lista de códigos válidos tal cual", () => {
  const input = { permissionCodes: ["products.read", "orders.update_status"] };
  const result = updateRolePermissionsSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("updateRolePermissionsSchema acepta la lista vacía (revocar todo)", () => {
  const result = updateRolePermissionsSchema.safeParse({ permissionCodes: [] });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { permissionCodes: [] });
});

test("updateRolePermissionsSchema acepta el catálogo completo", () => {
  const result = updateRolePermissionsSchema.safeParse({ permissionCodes: ALL_CODES });
  assert.equal(result.success, true);
});

test("updateRolePermissionsSchema deja pasar duplicados sin deduplicar (lo hace el handler)", () => {
  const input = { permissionCodes: ["roles.read", "roles.read"] };
  const result = updateRolePermissionsSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("updateRolePermissionsSchema rechaza la lista si un solo código es inválido y señala su índice", () => {
  const result = updateRolePermissionsSchema.safeParse({
    permissionCodes: ["products.read", "*", "orders.read"],
  });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["permissionCodes", 1]);
});

test("updateRolePermissionsSchema exige permissionCodes como array", () => {
  for (const input of [{}, { permissionCodes: null }, { permissionCodes: "roles.update" }, null]) {
    const result = updateRolePermissionsSchema.safeParse(input);
    assert.equal(result.success, false, JSON.stringify(input));
  }
});

test("updateRolePermissionsSchema descarta claves extra como slug o roleId", () => {
  const result = updateRolePermissionsSchema.safeParse({
    permissionCodes: ["roles.read"],
    slug: "super_admin",
    roleId: UUID,
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { permissionCodes: ["roles.read"] });
});

// --- roleIdSchema ---

test("roleIdSchema acepta un uuid", () => {
  const result = roleIdSchema.safeParse(UUID);
  assert.equal(result.success, true);
  assert.equal(result.data, UUID);
});

test("roleIdSchema rechaza slugs, vacío y uuid malformado con 'Identificador inválido'", () => {
  for (const value of ["super_admin", "", "3f6c8b2a-1e9d-4c7b-8f2a", ` ${UUID}`, 42]) {
    const result = roleIdSchema.safeParse(value);
    assert.equal(result.success, false, String(value));
    assert.equal(result.error?.issues[0]?.message, "Identificador inválido");
  }
});
