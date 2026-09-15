import { and, asc, eq } from "drizzle-orm";

// Type-only: `@/lib/permissions` importa este repositorio, así que el import
// debe borrarse en compilación para no crear un ciclo en runtime.
import type { PermissionCode } from "@/lib/permissions";
import { db } from "@/server/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
  type Permission,
} from "@/server/db/schema";

export async function list(): Promise<Permission[]> {
  return db.select().from(permissions).orderBy(asc(permissions.code));
}

// Permisos efectivos de un usuario en una sola query: sin esto, resolver roles y
// después sus permisos es un N+1.
export async function listCodesByClerkId(
  clerkId: string,
): Promise<PermissionCode[]> {
  const rows = await db
    .select({ code: permissions.code })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    // Un usuario desactivado no conserva permisos: si no, `users.deactivate` no
    // haría nada hasta que expire la sesión de Clerk.
    .where(and(eq(users.clerkId, clerkId), eq(users.isActive, true)));

  return rows.map((row) => row.code as PermissionCode);
}

export async function listCodesByRoleSlug(
  slug: string,
): Promise<PermissionCode[]> {
  const rows = await db
    .select({ code: permissions.code })
    .from(roles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(roles.slug, slug));

  return rows.map((row) => row.code as PermissionCode);
}
