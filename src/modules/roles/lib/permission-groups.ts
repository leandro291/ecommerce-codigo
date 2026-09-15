import type { Permission } from "@/modules/roles/types/role";

// Único lugar donde el catálogo técnico se traduce a lenguaje de negocio: al
// usuario nunca se le muestra un `code`. Si el catálogo crece y falta una
// etiqueta, cae al segmento crudo en vez de romper la pantalla.
const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Panel",
  products: "Productos",
  categories: "Categorías",
  orders: "Pedidos",
  customers: "Clientes",
  users: "Usuarios",
  roles: "Puestos",
  audit_logs: "Bitácora",
};

const ACTION_LABELS: Record<string, string> = {
  read: "ver",
  create: "crear",
  update: "editar",
  delete: "eliminar",
  update_status: "cambiar estado",
  deactivate: "desactivar",
  assign_role: "asignar puestos",
  assign_admin: "asignar administradores",
};

function humanize(segment: string): string {
  return segment.replace(/_/g, " ");
}

export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? humanize(resource);
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

export type PermissionGroup = {
  resource: string;
  label: string;
  permissions: Permission[];
};

// Conserva el orden de entrada (el catálogo llega ordenado por `code`), así el
// listado y el diálogo muestran siempre los mismos grupos en el mismo lugar.
export function groupByResource(
  permissions: readonly Permission[],
): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();

  for (const permission of permissions) {
    let group = groups.get(permission.resource);

    if (!group) {
      group = {
        resource: permission.resource,
        label: resourceLabel(permission.resource),
        permissions: [],
      };
      groups.set(permission.resource, group);
    }

    group.permissions.push(permission);
  }

  return [...groups.values()];
}
