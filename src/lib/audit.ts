import type { Tx } from "@/server/db";
import { auditLogs, type AuditChanges } from "@/server/db/schema";

export type AuditEntry = {
  actorId: string | null; // users.id; null = sistema / webhook / cron
  action: string; // "user.created", "role.assigned"
  entityType: string; // "user", "role"
  entityId?: string | null;
  changes?: AuditChanges | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: "info" | "warning" | "error";
};

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /pass|token|secret|api[-_]?key|private[-_]?key|authorization|credential|cookie|bearer|session/i;
// Términos demasiado cortos para buscarlos como subcadena: `/pin/i` redactaría
// `shippingAddress` (shi-PIN-g). Se comparan contra los segmentos de la clave.
const SENSITIVE_SEGMENT = new Set(["pin", "cvv", "ssn", "jwt"]);

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY.test(key)) return true;

  return key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((segment) => SENSITIVE_SEGMENT.has(segment));
}

// Heurística por nombre de clave: red de contención, no sustituto de la regla de
// que el llamador nunca meta secretos en `changes` (SETUP.md §5.2 regla 3).
export function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive);

  if (value instanceof Date) return value;

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        isSensitiveKey(key) ? REDACTED : stripSensitive(nested),
      ]),
    );
  }

  return value;
}

// `tx` es obligatorio: la traza se escribe en la misma transacción que la
// mutación auditada, para que un rollback se la lleve también.
export async function logAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    changes: entry.changes
      ? (stripSensitive(entry.changes) as AuditChanges)
      : null,
    metadata: entry.metadata
      ? (stripSensitive(entry.metadata) as Record<string, unknown>)
      : null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    severity: entry.severity ?? "info",
  });
}
