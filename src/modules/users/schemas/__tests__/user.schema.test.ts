import assert from "node:assert/strict";
import { test } from "node:test";

import { ROLES } from "../../../../lib/rbac-catalog.ts";
import {
  assignRolesSchema,
  createUserSchema,
  listUsersQuerySchema,
  roleSlugSchema,
  updateUserSchema,
  userIdSchema,
} from "../user.schema.ts";

const UUID = "3f6c8b2a-1e9d-4c7b-8f2a-6d1e9c7b8f2a";
const EMAIL = "ana@example.com";
const ALL_SLUGS = ROLES.map((role) => role.slug);

// --- roleSlugSchema ---

test("roleSlugSchema acepta cada slug del catálogo", () => {
  for (const slug of ALL_SLUGS) {
    assert.equal(roleSlugSchema.safeParse(slug).success, true, slug);
  }
});

test("roleSlugSchema rechaza slugs inventados, nombres visibles y el comodín", () => {
  for (const value of ["owner", "root", "superadmin", "Dueño", "Administrador", "*"]) {
    assert.equal(roleSlugSchema.safeParse(value).success, false, value);
  }
});

test("roleSlugSchema no recorta ni normaliza mayúsculas", () => {
  for (const value of [" admin", "admin ", "ADMIN", "Super_Admin"]) {
    assert.equal(roleSlugSchema.safeParse(value).success, false, value);
  }
});

test("roleSlugSchema rechaza vacío y tipos que no son string", () => {
  for (const value of ["", null, undefined, 1, ["admin"], { slug: "admin" }]) {
    assert.equal(roleSlugSchema.safeParse(value).success, false, String(value));
  }
});

// --- createUserSchema ---

test("createUserSchema acepta email y puesto sin nombres", () => {
  const input = { email: EMAIL, roleSlug: "employee" };
  const result = createUserSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("createUserSchema recorta nombre y apellido", () => {
  const result = createUserSchema.safeParse({
    email: EMAIL,
    firstName: "  Ana ",
    lastName: " Pérez  ",
    roleSlug: "manager",
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.firstName, "Ana");
  assert.equal(result.data?.lastName, "Pérez");
});

test("createUserSchema acepta nombres de 80 caracteres y rechaza 81", () => {
  const ok = createUserSchema.safeParse({ email: EMAIL, firstName: "a".repeat(80), roleSlug: "audit" });
  assert.equal(ok.success, true);

  const tooLong = createUserSchema.safeParse({ email: EMAIL, lastName: "a".repeat(81), roleSlug: "audit" });
  assert.equal(tooLong.success, false);
  assert.deepEqual(tooLong.error?.issues[0]?.path, ["lastName"]);
  assert.equal(tooLong.error?.issues[0]?.message, "No puede superar los 80 caracteres");
});

test("createUserSchema cuenta el largo después del trim", () => {
  const result = createUserSchema.safeParse({
    email: EMAIL,
    firstName: `  ${"a".repeat(80)}  `,
    roleSlug: "audit",
  });
  assert.equal(result.success, true);
});

test("createUserSchema deja pasar nombre vacío o solo espacios como cadena vacía", () => {
  const result = createUserSchema.safeParse({ email: EMAIL, firstName: "   ", roleSlug: "audit" });
  assert.equal(result.success, true);
  assert.equal(result.data?.firstName, "");
});

test("createUserSchema rechaza emails con formato inválido con 'Email inválido'", () => {
  for (const email of ["", "ana", "ana@", "@example.com", "ana@example", "ana example@example.com", ` ${EMAIL}`]) {
    const result = createUserSchema.safeParse({ email, roleSlug: "audit" });
    assert.equal(result.success, false, email);
    assert.equal(result.error?.issues[0]?.message, "Email inválido", email);
  }
});

test("createUserSchema exige el email", () => {
  const result = createUserSchema.safeParse({ roleSlug: "audit" });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["email"]);
});

test("createUserSchema exige un único roleSlug del catálogo", () => {
  for (const input of [
    { email: EMAIL },
    { email: EMAIL, roleSlug: "owner" },
    { email: EMAIL, roleSlug: ["admin"] },
  ]) {
    const result = createUserSchema.safeParse(input);
    assert.equal(result.success, false, JSON.stringify(input));
    assert.deepEqual(result.error?.issues[0]?.path, ["roleSlug"]);
  }
});

test("createUserSchema descarta claves extra como password, roleSlugs o clerkId", () => {
  const result = createUserSchema.safeParse({
    email: EMAIL,
    roleSlug: "employee",
    password: "Secreta123!",
    roleSlugs: ["super_admin"],
    clerkId: "user_123",
    isActive: false,
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { email: EMAIL, roleSlug: "employee" });
});

// --- updateUserSchema ---

test("updateUserSchema acepta solo el perfil recortado", () => {
  const result = updateUserSchema.safeParse({ firstName: " Ana ", lastName: "Pérez" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { firstName: "Ana", lastName: "Pérez" });
});

test("updateUserSchema acepta solo roleSlugs", () => {
  const input = { roleSlugs: ["manager", "audit"] };
  const result = updateUserSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("updateUserSchema acepta roleSlugs vacío (quitar todos los puestos)", () => {
  const result = updateUserSchema.safeParse({ roleSlugs: [] });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { roleSlugs: [] });
});

test("updateUserSchema deja pasar duplicados sin deduplicar (lo hace el handler)", () => {
  const input = { roleSlugs: ["audit", "audit"] };
  const result = updateUserSchema.safeParse(input);
  assert.equal(result.success, true);
  assert.deepEqual(result.data, input);
});

test("updateUserSchema rechaza un objeto vacío con 'Nada para actualizar'", () => {
  const result = updateUserSchema.safeParse({});
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Nada para actualizar");
});

test("updateUserSchema rechaza con 'Nada para actualizar' si solo llegan claves desconocidas", () => {
  const result = updateUserSchema.safeParse({ email: EMAIL, isActive: false, clerkId: "user_123" });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "Nada para actualizar");
});

test("updateUserSchema descarta email e isActive junto a campos conocidos", () => {
  const result = updateUserSchema.safeParse({ firstName: "Ana", email: EMAIL, isActive: false });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { firstName: "Ana" });
});

test("updateUserSchema rechaza la lista si un slug es inventado y señala su índice", () => {
  const result = updateUserSchema.safeParse({ roleSlugs: ["audit", "root", "manager"] });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["roleSlugs", 1]);
});

test("updateUserSchema exige roleSlugs como array", () => {
  for (const roleSlugs of ["admin", null, { 0: "admin" }]) {
    const result = updateUserSchema.safeParse({ roleSlugs });
    assert.equal(result.success, false, JSON.stringify(roleSlugs));
  }
});

test("updateUserSchema aplica el límite de 80 caracteres al perfil", () => {
  const result = updateUserSchema.safeParse({ firstName: "a".repeat(81) });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, "No puede superar los 80 caracteres");
});

// --- assignRolesSchema ---

test("assignRolesSchema acepta una lista de slugs y la lista vacía", () => {
  for (const roleSlugs of [["employee"], ["manager", "audit"], []]) {
    const result = assignRolesSchema.safeParse({ roleSlugs });
    assert.equal(result.success, true, JSON.stringify(roleSlugs));
    assert.deepEqual(result.data, { roleSlugs });
  }
});

test("assignRolesSchema exige roleSlugs", () => {
  for (const input of [{}, { roleSlugs: undefined }, { roleSlugs: "admin" }, null]) {
    assert.equal(assignRolesSchema.safeParse(input).success, false, JSON.stringify(input));
  }
});

test("assignRolesSchema rechaza slugs fuera del catálogo", () => {
  const result = assignRolesSchema.safeParse({ roleSlugs: ["employee", "SUPER_ADMIN"] });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues[0]?.path, ["roleSlugs", 1]);
});

// --- userIdSchema ---

test("userIdSchema acepta un uuid", () => {
  const result = userIdSchema.safeParse(UUID);
  assert.equal(result.success, true);
  assert.equal(result.data, UUID);
});

test("userIdSchema rechaza clerkId, email, vacío y uuid malformado con 'Identificador inválido'", () => {
  for (const value of ["user_2abc", EMAIL, "", "3f6c8b2a-1e9d-4c7b-8f2a", ` ${UUID}`, 42]) {
    const result = userIdSchema.safeParse(value);
    assert.equal(result.success, false, String(value));
    assert.equal(result.error?.issues[0]?.message, "Identificador inválido");
  }
});

// --- listUsersQuerySchema ---

test("listUsersQuerySchema acepta la query vacía sin defaults", () => {
  const result = listUsersQuerySchema.safeParse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {});
});

test("listUsersQuerySchema recorta search y acepta 80 caracteres pero no 81", () => {
  const trimmed = listUsersQuerySchema.safeParse({ search: "  ana  " });
  assert.equal(trimmed.data?.search, "ana");

  assert.equal(listUsersQuerySchema.safeParse({ search: "a".repeat(80) }).success, true);
  assert.equal(listUsersQuerySchema.safeParse({ search: "a".repeat(81) }).success, false);
});

test("listUsersQuerySchema acepta active solo como 'true' o 'false' sin coerción", () => {
  for (const active of ["true", "false"]) {
    assert.equal(listUsersQuerySchema.safeParse({ active }).data?.active, active);
  }
  for (const active of ["TRUE", "1", "", "yes", true, false]) {
    assert.equal(listUsersQuerySchema.safeParse({ active }).success, false, String(active));
  }
});

test("listUsersQuerySchema descarta parámetros desconocidos como page o role", () => {
  const result = listUsersQuerySchema.safeParse({ search: "ana", page: "2", role: "admin" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { search: "ana" });
});

// --- Observación (no BUG): el schema no filtra puestos por quién los asigna ---

test("createUserSchema acepta super_admin, admin y customer: la escalada la frena el handler, no el schema", () => {
  for (const roleSlug of ["super_admin", "admin", "customer"]) {
    assert.equal(createUserSchema.safeParse({ email: EMAIL, roleSlug }).success, true, roleSlug);
  }
});
