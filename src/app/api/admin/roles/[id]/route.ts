import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { syncClerkPublicMetadata } from "@/lib/clerk-sync";
import { requirePermission } from "@/lib/permissions";
import type { PermissionCode } from "@/lib/rbac-catalog";
import {
  roleIdSchema,
  updateRolePermissionsSchema,
} from "@/modules/roles/schemas/role.schema";
import type { RoleWithPermissions } from "@/modules/roles/types/role";
import { db } from "@/server/db";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

type Ctx = RouteContext<"/api/admin/roles/[id]">;

// El puesto del Dueño es `"*"`: todos los permisos, presentes y futuros. La
// comparación identifica la fila objetivo, no autoriza nada — la autorización
// la da `requirePermission` arriba (CLAUDE.md regla 8).
const OWNER_ROLE_SLUG = "super_admin";

// Solo este permiso se refleja en Clerk (`publicMetadata.panel`); el resto de la
// matriz se resuelve contra la base en cada request.
const PANEL_PERMISSION: PermissionCode = "dashboard.read";

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("roles.update");

  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsedId = roleIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateRolePermissionsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const desired = [...new Set(parsed.data.permissionCodes)];

  try {
    const role = await roleRepository.findById(parsedId.data);

    if (!role) {
      return NextResponse.json(
        { error: "Puesto no encontrado" },
        { status: 404 },
      );
    }

    // 409 y no 403: el Dueño **tiene** `roles.update`; es el estado del recurso
    // lo que no admite la edición. No se toca ninguna fila ni se audita.
    if (role.slug === OWNER_ROLE_SLUG) {
      return NextResponse.json(
        { error: "El puesto de Dueño tiene todos los permisos y no se edita" },
        { status: 409 },
      );
    }

    const actorId = guard.user?.id ?? null;

    // La traza va dentro de la misma transacción y es bloqueante: si falla el
    // log, revierte la mutación (SETUP §5.2 regla 4).
    const { granted, revoked } = await db.transaction(async (tx) => {
      const diff = await roleRepository.setPermissions(tx, role.id, desired);

      for (const code of diff.granted) {
        await logAudit(tx, {
          actorId,
          action: "role.permission_granted",
          entityType: "role",
          entityId: role.id,
          changes: { after: { permissionCode: code } },
          metadata: { roleSlug: role.slug, source: "admin-panel" },
          severity: "warning",
        });
      }

      for (const code of diff.revoked) {
        await logAudit(tx, {
          actorId,
          action: "role.permission_revoked",
          entityType: "role",
          entityId: role.id,
          changes: { before: { permissionCode: code } },
          metadata: { roleSlug: role.slug, source: "admin-panel" },
          severity: "warning",
        });
      }

      return diff;
    });

    // Fuera de la transacción: son llamadas de red y la verdad es la base. Solo
    // si el diff toca el acceso al panel: `publicMetadata` guarda `{roles,panel}`,
    // no la lista de permisos. Un `panel:false` rancio rebotaría en el borde para
    // siempre a quien acaba de ganar el acceso.
    if (granted.includes(PANEL_PERMISSION) || revoked.includes(PANEL_PERMISSION)) {
      const clerkIds = await userRepository.listClerkIdsByRoleId(role.id);

      for (const clerkId of clerkIds) {
        try {
          await syncClerkPublicMetadata(clerkId);
        } catch (syncError) {
          // Best-effort: la matriz ya commiteó y el layout server frena a quien
          // no corresponda. Se arregla con `npm run sync:clerk-users`.
          console.error(
            `PATCH /api/admin/roles/[id]: no se pudo resincronizar ${clerkId}`,
            syncError,
          );
        }
      }
    }

    const updated: RoleWithPermissions = {
      ...role,
      permissionCodes: [...desired].sort(),
    };

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/roles/[id]", error);
    return NextResponse.json(
      { error: "No se pudieron actualizar los permisos del puesto" },
      { status: 500 },
    );
  }
}
