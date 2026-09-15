import { PERMISSIONS, ROLES } from "@/lib/rbac-catalog";
import type { AuditLogRow, AuditSeverity } from "@/modules/audit/types/audit-log";

// Vocabulario propio de la bitácora: `permission-groups.ts` traduce el
// `resource`/`action` de un permiso, acá se traduce una acción de auditoría.
// Segundo consumidor, no tercero (CLAUDE.md §6): sin extracción compartida.
// Una acción fuera del mapa se muestra cruda en vez de romper la tabla (AC8).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.created": "Alta de persona",
  "user.deleted": "Baja de persona",
  "role.assigned": "Puesto asignado",
  "role.revoked": "Puesto quitado",
  "role.permission_granted": "Permiso otorgado a un puesto",
  "role.permission_revoked": "Permiso quitado a un puesto",
  "order.created": "Pedido iniciado",
  "order.paid": "Pedido pagado",
  "order.fulfillment_failed": "Pedido pagado sin poder prepararse",
};

export const ENTITY_LABELS: Record<string, string> = {
  user: "Persona",
  role: "Puesto",
  order: "Pedido",
};

export const SEVERITY: Record<
  AuditSeverity,
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  info: { label: "Info", variant: "secondary" },
  warning: { label: "Advertencia", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
};

export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Del catálogo, nunca el `code`/`slug` crudo: solo cae al valor técnico si el
// catálogo no lo conoce (misma salida de emergencia que `permission-groups`).
function permissionLabel(code: string): string {
  return PERMISSIONS.find((p) => p.code === code)?.description ?? code;
}

function roleLabel(slug: string): string {
  return ROLES.find((role) => role.slug === slug)?.name ?? slug;
}

// La frase de la fila expandida: "Se quitó el permiso «Eliminar productos» del
// puesto «Encargado»".
export function describeChange(row: AuditLogRow): string {
  const roleSlug = text(row.metadata?.roleSlug);
  // Tres formas de la misma frase: sin el nombre del puesto la oración tiene
  // que seguir leyéndose ("Se quitó un puesto", no "Se quitó el puesto —").
  const named = roleSlug ? `puesto «${roleLabel(roleSlug)}»` : null;
  const role = named ? `el ${named}` : "un puesto";
  const toRole = named ? `al ${named}` : "a un puesto";
  const fromRole = named ? `del ${named}` : "de un puesto";

  const permissionCode =
    text(row.changes?.after?.permissionCode) ??
    text(row.changes?.before?.permissionCode);
  const permission = permissionCode
    ? `el permiso «${permissionLabel(permissionCode)}»`
    : "un permiso";

  switch (row.action) {
    case "user.created":
      return roleSlug
        ? `Se dio de alta una persona con ${role}`
        : "Se dio de alta una persona";
    case "user.deleted":
      return "Se dio de baja una persona";
    case "role.assigned":
      return `Se asignó ${role}`;
    case "role.revoked":
      return `Se quitó ${role}`;
    case "role.permission_granted":
      return `Se dio ${permission} ${toRole}`;
    case "role.permission_revoked":
      return `Se quitó ${permission} ${fromRole}`;
    default:
      return actionLabel(row.action);
  }
}
