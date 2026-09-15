import { and, asc, eq, inArray } from "drizzle-orm";

// Del catálogo puro: es dato sin imports, no crea ciclo con `@/lib/permissions`.
import type { PermissionCode } from "@/lib/rbac-catalog";
import { db, type Tx } from "@/server/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  type Role,
} from "@/server/db/schema";

export async function list(): Promise<Role[]> {
  return db.select().from(roles).orderBy(asc(roles.name));
}

export async function findById(id: string): Promise<Role | undefined> {
  const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);

  return role;
}

// Toda la matriz en una query en vez de una lectura por puesto (N+1 de 6).
export async function listPermissionCodesByRole(): Promise<
  Map<string, PermissionCode[]>
> {
  const rows = await db
    .select({ roleId: rolePermissions.roleId, code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .orderBy(asc(permissions.code));

  const byRole = new Map<string, PermissionCode[]>();

  for (const row of rows) {
    const codes = byRole.get(row.roleId) ?? [];
    codes.push(row.code as PermissionCode);
    byRole.set(row.roleId, codes);
  }

  return byRole;
}

// El diff vive acá y no en el handler: sin `SELECT` sueltos fuera del
// repositorio (CLAUDE.md regla 3) y sin ventana entre leer y escribir, porque
// las dos lecturas y las dos escrituras corren en la misma transacción.
// Devuelve solo lo que cambió: es lo que el handler audita.
export async function setPermissions(
  tx: Tx,
  roleId: string,
  desiredCodes: readonly PermissionCode[],
): Promise<{ granted: PermissionCode[]; revoked: PermissionCode[] }> {
  const desired = new Set<string>(desiredCodes);

  const catalog = await tx
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);

  const idByCode = new Map(catalog.map((row) => [row.code, row.id]));
  const missing = [...desired].filter((code) => !idByCode.has(code));

  if (missing.length > 0) {
    throw new Error(
      `setPermissions: los permisos "${missing.join('", "')}" no existen en la tabla permissions; falta correr npm run db:seed`,
    );
  }

  const current = await tx
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId));

  const currentCodes = new Set(current.map((row) => row.code));

  const granted = [...desired]
    .filter((code) => !currentCodes.has(code))
    .sort() as PermissionCode[];
  const revoked = [...currentCodes]
    .filter((code) => !desired.has(code))
    .sort() as PermissionCode[];

  const idsFor = (codes: readonly string[]): string[] =>
    codes
      .map((code) => idByCode.get(code))
      .filter((id): id is string => id !== undefined);

  if (granted.length > 0) {
    await tx
      .insert(rolePermissions)
      .values(
        idsFor(granted).map((permissionId) => ({ roleId, permissionId })),
      );
  }

  if (revoked.length > 0) {
    await tx
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          inArray(rolePermissions.permissionId, idsFor(revoked)),
        ),
      );
  }

  return { granted, revoked };
}

// Orden estable: el resultado va a `publicMetadata.roles`, que el borde compara.
export async function listSlugsByUserId(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.slug));

  return rows.map((row) => row.slug);
}

export async function findBySlug(slug: string): Promise<Role | undefined> {
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, slug))
    .limit(1);

  return role;
}
