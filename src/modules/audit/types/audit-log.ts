// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
import type { AuditLog } from "@/server/db/schema";

export type { AuditLog };

export type AuditSeverity = AuditLog["severity"];

// Identidad mínima del actor para la columna Actor. `null` = fila del sistema
// (webhook de Clerk, `actor_id IS NULL`).
export type AuditActor = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

// `ip_address` y `user_agent` no salen del servidor (decisión 5): no se filtran
// en el cliente, directamente no están en el `select` del repositorio.
// ponytail: `createdAt` llega como string por JSON aunque el tipo diga Date.
// La tabla lo envuelve en `new Date(...)` antes de formatear.
export type AuditLogRow = Omit<AuditLog, "ipAddress" | "userAgent"> & {
  actor: AuditActor | null;
};

export type AuditLogsPage = {
  items: AuditLogRow[];
  nextCursor: string | null;
};

// Lo que la barra de filtros emite y el service manda como query string. El
// `cursor` no está acá: lo pone el hook desde `pageParam`.
export type AuditLogFilters = {
  action?: string;
  entityType?: string;
  // uuid de la persona, o "system" para las filas sin actor.
  actorId?: string;
  severity?: AuditSeverity;
  // `YYYY-MM-DD`, tal cual lo emite `<input type="date">`.
  from?: string;
  to?: string;
};
