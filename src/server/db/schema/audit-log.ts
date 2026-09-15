import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

export const auditSeverity = pgEnum("audit_severity", [
  "info",
  "warning",
  "error",
]);

export type AuditChanges = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

// Append-only: no hay UPDATE ni DELETE sobre esta tabla en el código.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // SET NULL, no CASCADE: borrar un usuario nunca borra su traza.
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb("changes").$type<AuditChanges>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    severity: auditSeverity("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_created_at_idx").on(t.actorId, t.createdAt.desc()),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_at_idx").on(t.createdAt.desc()),
  ],
);

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
