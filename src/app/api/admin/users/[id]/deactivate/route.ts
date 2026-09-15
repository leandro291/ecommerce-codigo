import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { syncClerkPublicMetadata } from "@/lib/clerk-sync";
import { requirePermission } from "@/lib/permissions";
import { userIdSchema } from "@/modules/users/schemas/user.schema";
import { db } from "@/server/db";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

type Ctx = RouteContext<"/api/admin/users/[id]/deactivate">;

const OWNER_ROLE_SLUG = "super_admin";

export async function POST(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("users.deactivate");

  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsedId = userIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  try {
    const target = await userRepository.findById(parsedId.data);

    if (!target) {
      return NextResponse.json(
        { error: "Persona no encontrada" },
        { status: 404 },
      );
    }

    if (target.id === guard.user?.id) {
      return NextResponse.json(
        { error: "No podés desactivarte a vos mismo" },
        { status: 409 },
      );
    }

    // Pre-filtro fuera de la transacción: el que serializa de verdad es el
    // `FOR UPDATE` de `countActiveByRoleSlug`, que bloquea las filas de los
    // dueños activos hasta el commit.
    const slugs = await roleRepository.listSlugsByUserId(target.id);
    const isOwner = slugs.includes(OWNER_ROLE_SLUG);

    const lastOwner = await db.transaction(async (tx) => {
      if (isOwner) {
        const active = await userRepository.countActiveByRoleSlug(
          tx,
          OWNER_ROLE_SLUG,
        );

        if (active <= 1) return true;
      }

      const user = await userRepository.deactivateByClerkId(tx, target.clerkId);

      // `undefined` = ya estaba inactiva: no se audita de nuevo.
      if (user) {
        await userRepository.revokeAllRoles(tx, user.id);
        await logAudit(tx, {
          actorId: guard.user?.id ?? null,
          action: "user.deleted",
          entityType: "user",
          entityId: user.id,
          metadata: { clerkId: target.clerkId, source: "admin-panel" },
          severity: "warning",
        });
      }

      return false;
    });

    if (lastOwner) {
      return NextResponse.json(
        { error: "No podés desactivar al último Dueño activo" },
        { status: 409 },
      );
    }

    // `ban` y no `lock`: el lock caduca solo en ~1 h. Si falla, la base ya dice
    // `is_active=false` y sus permisos resuelven vacío; se reintenta desactivando.
    try {
      const client = await clerkClient();
      await client.users.banUser(target.clerkId);
    } catch (error) {
      console.error(
        `POST /api/admin/users/[id]/deactivate: no se pudo banear ${target.clerkId} en Clerk`,
        error,
      );
    }

    await syncClerkPublicMetadata(target.clerkId);

    const [updated] = await userRepository.list({ id: target.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Persona no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/admin/users/[id]/deactivate", error);
    return NextResponse.json(
      { error: "No se pudo desactivar la persona" },
      { status: 500 },
    );
  }
}
