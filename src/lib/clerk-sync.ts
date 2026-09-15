import { clerkClient } from "@clerk/nextjs/server";

import { logAudit } from "@/lib/audit";
import { generateTemporaryPassword } from "@/lib/password";
// Type-only a propósito: `@/lib/permissions` arrastra `next/server` y `react`,
// que no se pueden cargar desde el script de backfill (`tsx`).
import type { PermissionCode, RoleSlug } from "@/lib/permissions";
import type { UserWithRoles } from "@/modules/users/types/user";
import { db } from "@/server/db";
import type { User } from "@/server/db/schema";
import * as permissionRepository from "@/server/repositories/permission.repository";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";
import type { ClerkUserInput } from "@/server/repositories/user.repository";

export type { ClerkUserInput };

// Resumen derivado que el borde lee en la fase 3 desde `sessionClaims.metadata`.
export type PanelMetadata = { roles: string[]; panel: boolean };

const DEFAULT_ROLE_SLUG: RoleSlug = "customer";
// Quién ve el panel lo define la matriz, no una lista de roles duplicada acá.
const PANEL_PERMISSION: PermissionCode = "dashboard.read";
const AUDIT_SOURCE = "clerk-webhook";

type SyncContext = { svixId?: string | null };

function auditMetadata(
  clerkId: string,
  ctx: SyncContext,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { clerkId, svixId: ctx.svixId ?? null, source: AUDIT_SOURCE, ...extra };
}

// Alta o actualización del espejo local. Idempotente: el mismo evento reenviado
// por Svix actualiza la fila y no vuelve a auditar (AC3).
export async function upsertUserFromClerk(
  input: ClerkUserInput,
  ctx: SyncContext,
): Promise<{ user: User; created: boolean; assignedDefaultRole: boolean }> {
  return db.transaction(async (tx) => {
    const { user, created, reclaimedFrom } =
      await userRepository.upsertByClerkId(tx, input);

    // Solo si no tiene ningún puesto: la fase 4 puede haberlo creado ya como
    // `manager` y el webhook no debe degradarlo agregándole `customer` (AC4).
    const slugs = await roleRepository.listSlugsByUserId(user.id);
    let assignedDefaultRole = false;

    if (slugs.length === 0) {
      const role = await roleRepository.findBySlug(DEFAULT_ROLE_SLUG);

      if (!role) {
        throw new Error(
          `clerk-sync: no existe el rol "${DEFAULT_ROLE_SLUG}"; falta correr npm run db:seed`,
        );
      }

      await userRepository.assignRole(tx, { userId: user.id, roleId: role.id });
      assignedDefaultRole = true;
    }

    // `user.updated` no se audita: no es una mutación de seguridad.
    if (created) {
      await logAudit(tx, {
        actorId: null,
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        metadata: auditMetadata(
          input.clerkId,
          ctx,
          reclaimedFrom ? { reclaimedFrom } : undefined,
        ),
      });
    }

    return { user, created, assignedDefaultRole };
  });
}

// Baja lógica. `false` = la fila ya estaba inactiva, no se audita de nuevo (AC6).
export async function deactivateUserFromClerk(
  clerkId: string,
  ctx: SyncContext,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const user = await userRepository.deactivateByClerkId(tx, clerkId);

    if (!user) return false;

    await userRepository.revokeAllRoles(tx, user.id);
    await logAudit(tx, {
      actorId: null,
      action: "user.deleted",
      entityType: "user",
      entityId: user.id,
      metadata: auditMetadata(clerkId, ctx),
      severity: "warning",
    });

    return true;
  });
}

// --- Alta desde el panel ---------------------------------------------------

export type CreateTeamMemberInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  roleSlug: RoleSlug;
};

// Alta de una persona del panel: primero en Clerk (dueño de la identidad),
// después el espejo local. La contraseña temporal se devuelve al llamador y no
// se persiste ni se audita en ningún lado (AC11).
export async function createTeamMember(
  input: CreateTeamMemberInput,
  ctx: { actorId: string | null },
): Promise<{ user: UserWithRoles; temporaryPassword: string }> {
  // Antes de tocar Clerk: si el puesto no existe, no hay nada que compensar.
  const role = await roleRepository.findBySlug(input.roleSlug);

  if (!role) {
    throw new Error(
      `clerk-sync: no existe el rol "${input.roleSlug}"; falta correr npm run db:seed`,
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const client = await clerkClient();

  const clerkUser = await client.users.createUser({
    emailAddress: [input.email],
    password: temporaryPassword,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  let user: User;

  try {
    user = await db.transaction(async (tx) => {
      const { user: row } = await userRepository.upsertByClerkId(tx, {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? input.email,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        imageUrl: clerkUser.imageUrl,
      });

      // Si el webhook `user.created` ganó la carrera ya le puso `customer`:
      // se revoca todo antes de asignar para que no queden dos puestos (AC6).
      await userRepository.revokeAllRoles(tx, row.id);
      await userRepository.assignRole(tx, {
        userId: row.id,
        roleId: role.id,
        assignedBy: ctx.actorId,
      });

      await logAudit(tx, {
        actorId: ctx.actorId,
        action: "user.created",
        entityType: "user",
        entityId: row.id,
        metadata: {
          clerkId: clerkUser.id,
          source: "admin-panel",
          roleSlug: input.roleSlug,
        },
      });

      return row;
    });
  } catch (error) {
    // Sin esto el email queda quemado en Clerk y todo reintento da 409.
    try {
      await client.users.deleteUser(clerkUser.id);
    } catch (cleanupError) {
      console.error(
        `createTeamMember: quedó un usuario huérfano en Clerk (${clerkUser.id})`,
        cleanupError,
      );
    }

    throw error;
  }

  await syncClerkPublicMetadata(clerkUser.id);

  return { user: { ...user, roles: [role] }, temporaryPassword };
}

// Cache derivado en Clerk de lo que ya está en Postgres. Se llama FUERA de la
// transacción: es una llamada de red y la fuente de verdad es la base.
export async function syncClerkPublicMetadata(clerkId: string): Promise<void> {
  const user = await userRepository.findByClerkId(clerkId);

  if (!user) return;

  const [roles, codes] = await Promise.all([
    roleRepository.listSlugsByUserId(user.id),
    permissionRepository.listCodesByClerkId(clerkId),
  ]);

  const publicMetadata: PanelMetadata = {
    roles,
    panel: codes.includes(PANEL_PERMISSION),
  };

  const client = await clerkClient();

  await client.users.updateUserMetadata(clerkId, { publicMetadata });
}
