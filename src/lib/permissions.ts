import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cache } from "react";

import {
  can,
  DEFAULT_ROLE_SLUG,
  type PermissionCode,
} from "@/lib/rbac-catalog";
import type { User } from "@/server/db/schema";
import * as permissionRepository from "@/server/repositories/permission.repository";
import * as userRepository from "@/server/repositories/user.repository";

// El catálogo (datos puros) vive en `@/lib/rbac-catalog` para poder importarse
// desde el cliente; se re-exporta acá para que los llamadores no cambien.
export * from "@/lib/rbac-catalog";

// --- Resolución en runtime -------------------------------------------------

// `cache()` memoiza por request: el layout del panel resuelve permisos para el
// guard y otra vez para filtrar el nav, y sale una sola query.
export const resolvePermissions = cache(
  async (clerkId: string): Promise<Set<PermissionCode>> => {
    const codes = await permissionRepository.listCodesByClerkId(clerkId);

    if (codes.length > 0) return new Set(codes);

    // Sin fila en `users`, sin puesto asignado o desactivado: valen los permisos
    // del rol por defecto, leídos de la BD para no duplicar el default acá.
    return new Set(
      await permissionRepository.listCodesByRoleSlug(DEFAULT_ROLE_SLUG),
    );
  },
);

export const getUserByClerkId = cache(
  async (clerkId: string): Promise<User | null> =>
    (await userRepository.findByClerkId(clerkId)) ?? null,
);

// Unión discriminada en vez de excepción: `tsc` obliga al handler a manejar el
// caso y la forma es la misma que ya usan los handlers actuales.
export type Guard =
  | {
      ok: true;
      clerkId: string;
      user: User | null;
      permissions: Set<PermissionCode>;
    }
  | { ok: false; response: NextResponse };

export async function requirePermission(code: PermissionCode): Promise<Guard> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const permissions = await resolvePermissions(userId);

  if (!can(permissions, code)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No tenés permiso para esta acción" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    clerkId: userId,
    user: await getUserByClerkId(userId),
    permissions,
  };
}
