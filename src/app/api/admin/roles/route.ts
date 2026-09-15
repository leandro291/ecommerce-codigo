import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions";
import type { RolesPageData } from "@/modules/roles/types/role";
import * as permissionRepository from "@/server/repositories/permission.repository";
import * as roleRepository from "@/server/repositories/role.repository";

export async function GET() {
  const guard = await requirePermission("roles.read");

  if (!guard.ok) return guard.response;

  try {
    const [roles, codesByRole, permissions] = await Promise.all([
      roleRepository.list(),
      roleRepository.listPermissionCodesByRole(),
      permissionRepository.list(),
    ]);

    const data: RolesPageData = {
      roles: roles.map((role) => ({
        ...role,
        permissionCodes: codesByRole.get(role.id) ?? [],
      })),
      permissions,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/admin/roles", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los puestos" },
      { status: 500 },
    );
  }
}
