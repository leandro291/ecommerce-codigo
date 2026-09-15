import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { NextResponse, type NextRequest } from "next/server";

import { createTeamMember } from "@/lib/clerk-sync";
import { can, requirePermission } from "@/lib/permissions";
import { ADMIN_ROLE_SLUGS } from "@/lib/rbac-catalog";
import {
  createUserSchema,
  listUsersQuerySchema,
} from "@/modules/users/schemas/user.schema";
import * as userRepository from "@/server/repositories/user.repository";

export async function GET(request: NextRequest) {
  const guard = await requirePermission("users.read");

  if (!guard.ok) return guard.response;

  const query = listUsersQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  try {
    const users = await userRepository.list({
      search: query.data.search,
      isActive:
        query.data.active === undefined
          ? undefined
          : query.data.active === "true",
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/admin/users", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las personas" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission("users.create");

  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // La UI oculta las opciones, pero el servidor las vuelve a validar siempre.
  if (
    ADMIN_ROLE_SLUGS.includes(parsed.data.roleSlug) &&
    !can(guard.permissions, "users.assign_admin")
  ) {
    return NextResponse.json(
      { error: "No tenés permiso para asignar ese puesto" },
      { status: 403 },
    );
  }

  try {
    const { user, temporaryPassword } = await createTeamMember(parsed.data, {
      actorId: guard.user?.id ?? null,
    });

    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  } catch (error) {
    if (isClerkAPIResponseError(error)) {
      const inUse = error.errors.some(
        (issue) => issue.code === "form_identifier_exists",
      );

      if (inUse) {
        return NextResponse.json(
          { error: "Ya existe una persona con ese email" },
          { status: 409 },
        );
      }
    }

    console.error("POST /api/admin/users", error);
    return NextResponse.json(
      { error: "No se pudo crear la persona" },
      { status: 500 },
    );
  }
}
