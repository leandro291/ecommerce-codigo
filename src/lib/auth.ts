import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  can,
  getUserByClerkId,
  resolvePermissions,
  type PermissionCode,
} from "@/lib/permissions";
import type { User } from "@/server/db/schema";

export type CurrentUser = {
  clerkId: string;
  // `null` hasta que el webhook de Clerk (fase 2) llene `users`.
  user: User | null;
  permissions: Set<PermissionCode>;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();

  if (!userId) return null;

  return {
    clerkId: userId,
    user: await getUserByClerkId(userId),
    permissions: await resolvePermissions(userId),
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const current = await getCurrentUser();

  if (!current) redirect("/sign-in");

  return current;
}

// Guard de Route Handler que solo pide sesión (sin permisos): lo usan las rutas
// de cliente como `/api/cart`. Misma unión discriminada que `Guard` de
// `permissions.ts`, pero con `user` no nulo: quien consulta datos propios
// necesita sí o sí la fila local.
export type SessionGuard =
  { ok: true; user: User } | { ok: false; response: NextResponse };

export async function requireSessionUser(): Promise<SessionGuard> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  // `users` lo llena el webhook de Clerk (spec 005). Si todavía no espejó al
  // usuario se corta acá; no se crea la fila al vuelo.
  const user = await getUserByClerkId(userId);

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Tu cuenta todavía se está sincronizando, probá en un momento",
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}

// "Acceso al panel" = tener `dashboard.read`. Lo consume el layout de admin en
// la fase 3; `/sin-acceso` se crea en el spec 006.
export async function requirePanelAccess(): Promise<CurrentUser> {
  const current = await requireAuth();

  if (!can(current.permissions, "dashboard.read")) redirect("/sin-acceso");

  return current;
}
