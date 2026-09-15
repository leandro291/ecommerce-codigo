// SOLO LECTURA. `audit_logs` es append-only (SETUP.md §5.2 regla 1): el único
// INSERT del sistema vive en `logAudit` (`src/lib/audit.ts`), que exige `tx`
// para escribir la traza en la misma transacción que la mutación auditada.
// Este archivo no importa ni exporta nada que escriba —ni INSERT, ni UPDATE,
// ni DELETE— y no es el lugar para agregarlo.
import { and, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";

// `import type`: se borra en compilación, no arrastra el módulo cliente al server.
// El cursor —`(created_at, id)` de la última fila devuelta; el `id` desempata
// dos eventos de la misma transacción— se parsea en `lib/cursor.ts`.
import type { AuditLogCursor } from "@/modules/audit/lib/cursor";
import type {
  AuditLogsPage,
  AuditSeverity,
} from "@/modules/audit/types/audit-log";
import { db } from "@/server/db";
import { auditLogs, users } from "@/server/db/schema";

export type AuditLogListParams = {
  action?: string;
  entityType?: string;
  actorId?: string; // uuid, o "system" para las filas sin actor
  severity?: AuditSeverity;
  from?: Date; // inclusivo
  to?: Date; // exclusivo: lo calcula el handler sumando un día
  limit: number;
  cursor?: AuditLogCursor;
};

export const SYSTEM_ACTOR_ID = "system";

export async function list(
  params: AuditLogListParams,
): Promise<AuditLogsPage> {
  const conditions: SQL[] = [];

  if (params.action) conditions.push(eq(auditLogs.action, params.action));

  if (params.entityType) {
    conditions.push(eq(auditLogs.entityType, params.entityType));
  }

  if (params.actorId) {
    conditions.push(
      params.actorId === SYSTEM_ACTOR_ID
        ? isNull(auditLogs.actorId)
        : eq(auditLogs.actorId, params.actorId),
    );
  }

  if (params.severity) conditions.push(eq(auditLogs.severity, params.severity));
  if (params.from) conditions.push(gte(auditLogs.createdAt, params.from));
  if (params.to) conditions.push(lt(auditLogs.createdAt, params.to));

  // Keyset por comparación de filas de Postgres: estable ante inserciones
  // concurrentes, a diferencia del OFFSET (decisión 1).
  if (params.cursor) {
    conditions.push(
      sql`(${auditLogs.createdAt}, ${auditLogs.id}) < (${params.cursor.createdAt.toISOString()}::timestamptz, ${params.cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      changes: auditLogs.changes,
      metadata: auditLogs.metadata,
      severity: auditLogs.severity,
      createdAt: auditLogs.createdAt,
      // `ipAddress`/`userAgent` quedan fuera a propósito (decisión 5): hoy
      // nadie los escribe y si mañana se escriben son PII de rastreo.
      actorEmail: users.email,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
    })
    .from(auditLogs)
    // LEFT: las filas del sistema (`actor_id` null) tienen que seguir saliendo.
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    // Una fila de más: si vuelve, hay página siguiente y el cursor sale de la
    // última fila de esta página, no de la sobrante.
    .limit(params.limit + 1);

  const page = rows.slice(0, params.limit);
  const last = page.at(-1);

  return {
    items: page.map(({ actorEmail, actorFirstName, actorLastName, ...log }) => ({
      ...log,
      actor:
        log.actorId && actorEmail
          ? {
              id: log.actorId,
              email: actorEmail,
              firstName: actorFirstName,
              lastName: actorLastName,
            }
          : null,
    })),
    nextCursor:
      rows.length > params.limit && last
        ? `${last.createdAt.toISOString()}|${last.id}`
        : null,
  };
}
