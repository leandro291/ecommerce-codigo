"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PermissionCode } from "@/lib/rbac-catalog";
import * as roleService from "@/modules/roles/services/role.service";

export const rolesKey = ["roles"] as const;

export function useRoles() {
  return useQuery({
    queryKey: rolesKey,
    queryFn: roleService.listRoles,
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      permissionCodes,
    }: {
      id: string;
      permissionCodes: PermissionCode[];
    }) => roleService.updateRolePermissions(id, permissionCodes),
    // Los toasts quedan en el diálogo, que es quien conoce el texto.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKey }),
  });
}
