// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
import type { PermissionCode } from "@/lib/rbac-catalog";
import type { Permission, Role } from "@/server/db/schema";

export type { Permission, Role };

export type RoleWithPermissions = Role & {
  permissionCodes: PermissionCode[];
};

// Lo que devuelve `GET /api/admin/roles`: los puestos con su matriz y el
// catálogo completo, que es lo que la UI necesita para pintar los checkboxes.
export type RolesPageData = {
  roles: RoleWithPermissions[];
  permissions: Permission[];
};
