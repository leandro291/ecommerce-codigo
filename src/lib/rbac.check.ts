import assert from "node:assert/strict";

import {
  PERMISSIONS,
  permissionCodesForRole,
  ROLE_PERMISSIONS,
  ROLES,
  type RoleSlug,
} from "./rbac-catalog";

// Este check valida la **semilla** (`ROLE_PERMISSIONS`), no la matriz vigente:
// desde el spec 008 la verdad en runtime es la tabla `role_permissions`, que el
// Dueño edita desde `/admin/roles`. Que acá diga "admin no tiene roles.update"
// significa que el seed no se lo da, no que nadie pueda otorgárselo después.
//
// Todo desde `rbac-catalog.ts` (datos puros, sin imports): a diferencia de
// `permissions.ts`, carga sin Clerk ni `@/server/db`. La redacción de
// `stripSensitive` se prueba en `__tests__/audit.test.ts`, no acá.

const catalog = new Set<string>(PERMISSIONS.map((permission) => permission.code));

assert.equal(catalog.size, PERMISSIONS.length, "hay códigos duplicados en el catálogo");
assert.equal(catalog.size, 22, "el catálogo debe tener 22 permisos");
assert.equal(ROLES.length, 6, "deben ser 6 roles");

// Ningún permiso de la matriz puede faltar en el catálogo: el seed resuelve
// los ids por código y una divergencia rompería la siembra en silencio.
for (const role of ROLES) {
  for (const code of permissionCodesForRole(role.slug)) {
    assert.ok(catalog.has(code), `${role.slug}: el permiso "${code}" no está en el catálogo`);
  }
}

const expectedCounts: Record<RoleSlug, number> = {
  super_admin: 22,
  admin: 20,
  manager: 12,
  employee: 6,
  audit: 8,
  customer: 0,
};

let matrixRows = 0;

for (const role of ROLES) {
  const codes = permissionCodesForRole(role.slug);
  assert.equal(
    new Set(codes).size,
    codes.length,
    `${role.slug}: tiene permisos repetidos`,
  );
  assert.equal(
    codes.length,
    expectedCounts[role.slug],
    `${role.slug}: se esperaban ${expectedCounts[role.slug]} permisos y tiene ${codes.length}`,
  );
  matrixRows += codes.length;
}

assert.equal(matrixRows, 68, "la matriz debe sembrar 68 filas");
assert.equal(ROLE_PERMISSIONS.super_admin, "*", "el dueño hereda todo el catálogo");

// "Acceso al panel" = dashboard.read. El cliente no entra.
assert.ok(
  !permissionCodesForRole("customer").includes("dashboard.read"),
  "customer no debe tener dashboard.read",
);
assert.ok(
  !permissionCodesForRole("admin").includes("users.assign_admin"),
  "solo el dueño asigna administradores",
);
assert.ok(
  !permissionCodesForRole("admin").includes("roles.update"),
  "solo el dueño edita la matriz de permisos",
);

console.log("rbac: ok — 22 permisos, 6 roles, 68 filas de matriz");
