import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { syncClerkPublicMetadata } from "@/lib/clerk-sync";
import { can, requirePermission } from "@/lib/permissions";
import { ADMIN_ROLE_SLUGS } from "@/lib/rbac-catalog";
import {
  updateUserSchema,
  userIdSchema,
} from "@/modules/users/schemas/user.schema";
import { db } from "@/server/db";
import * as roleRepository from "@/server/repositories/role.repository";
import * as userRepository from "@/server/repositories/user.repository";

type Ctx = RouteContext<"/api/admin/users/[id]">;

const OWNER_ROLE_SLUG = "super_admin";

const notFound = () =>
  NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

const forbidden = () =>
  NextResponse.json(
    { error: "No tenés permiso para esta acción" },
    { status: 403 },
  );

export async function PATCH(request: NextRequest, ctx: Ctx) {
  // `users.read` es la puerta mínima del endpoint: autentica y resuelve
  // permisos. El permiso fino depende de qué campos traiga el body y se exige
  // más abajo, campo por campo.
  const guard = await requirePermission("users.read");

  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsedId = userIdSchema.safeParse(id);

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

  const parsed = updateUserSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { firstName, lastName, roleSlugs } = parsed.data;
  const touchesProfile = firstName !== undefined || lastName !== undefined;

  if (touchesProfile && !can(guard.permissions, "users.update")) {
    return forbidden();
  }

  if (roleSlugs && !can(guard.permissions, "users.assign_role")) {
    return forbidden();
  }

  try {
    const target = await userRepository.findById(parsedId.data);

    if (!target) return notFound();

    const current = await roleRepository.listSlugsByUserId(target.id);
    const desired: string[] = roleSlugs
      ? [...new Set<string>(roleSlugs)]
      : current;

    const toAssign = desired.filter((slug) => !current.includes(slug));
    const toRevoke = current.filter((slug) => !desired.includes(slug));

    // Tocar `admin`/`super_admin` en cualquiera de los dos sentidos es una
    // escalada: la UI lo oculta, el servidor lo vuelve a validar.
    const touchesAdmin = [...toAssign, ...toRevoke].some((slug) =>
      ADMIN_ROLE_SLUGS.includes(slug),
    );

    if (touchesAdmin && !can(guard.permissions, "users.assign_admin")) {
      return forbidden();
    }

    const roleBySlug = new Map(
      (await roleRepository.list()).map((role) => [role.slug, role]),
    );

    const actorId = guard.user?.id ?? null;

    const lastOwner = await db.transaction(async (tx) => {
      // Mismo guard que la baja: sin un Dueño activo nadie puede volver a tocar
      // puestos ni permisos. El `FOR UPDATE` serializa dos revocaciones
      // concurrentes, y va antes de cualquier escritura.
      if (toRevoke.includes(OWNER_ROLE_SLUG)) {
        const active = await userRepository.countActiveByRoleSlug(
          tx,
          OWNER_ROLE_SLUG,
        );

        if (active <= 1) return true;
      }

      if (touchesProfile) {
        await userRepository.updateProfile(tx, target.id, {
          ...(firstName !== undefined ? { firstName: firstName || null } : {}),
          ...(lastName !== undefined ? { lastName: lastName || null } : {}),
        });
      }

      for (const slug of toRevoke) {
        const role = roleBySlug.get(slug);

        if (!role) continue;

        await userRepository.revokeRole(tx, target.id, role.id);
        await logAudit(tx, {
          actorId,
          action: "role.revoked",
          entityType: "user",
          entityId: target.id,
          metadata: { roleSlug: slug, source: "admin-panel" },
          severity: "warning",
        });
      }

      for (const slug of toAssign) {
        const role = roleBySlug.get(slug);

        if (!role) {
          throw new Error(
            `PATCH /api/admin/users: no existe el rol "${slug}"; falta correr npm run db:seed`,
          );
        }

        await userRepository.assignRole(tx, {
          userId: target.id,
          roleId: role.id,
          assignedBy: actorId,
        });
        await logAudit(tx, {
          actorId,
          action: "role.assigned",
          entityType: "user",
          entityId: target.id,
          metadata: { roleSlug: slug, source: "admin-panel" },
        });
      }

      return false;
    });

    if (lastOwner) {
      return NextResponse.json(
        { error: "No podés quitar el último Dueño" },
        { status: 409 },
      );
    }

    // Fuera de la transacción: es una llamada de red y la verdad es la base.
    if (toAssign.length > 0 || toRevoke.length > 0) {
      await syncClerkPublicMetadata(target.clerkId);
    }

    const [updated] = await userRepository.list({ id: target.id });

    if (!updated) return notFound();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la persona" },
      { status: 500 },
    );
  }
}
