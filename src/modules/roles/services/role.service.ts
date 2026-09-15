import { api } from "@/lib/axios";
import type { PermissionCode } from "@/lib/rbac-catalog";
import type {
  RolesPageData,
  RoleWithPermissions,
} from "@/modules/roles/types/role";

const BASE_URL = "/admin/roles";

export async function listRoles(): Promise<RolesPageData> {
  const { data } = await api.get<RolesPageData>(BASE_URL);
  return data;
}

export async function updateRolePermissions(
  id: string,
  permissionCodes: PermissionCode[],
): Promise<RoleWithPermissions> {
  const { data } = await api.patch<RoleWithPermissions>(`${BASE_URL}/${id}`, {
    permissionCodes,
  });
  return data;
}
