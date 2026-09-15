import { z } from "zod";

import { parseCursor } from "@/modules/audit/lib/cursor";

// Mismo dato que el enum `audit_severity` del schema Drizzle, declarado acá para
// no arrastrar la BD al bundle. Tampoco sale de `@/lib/permissions`, que importa
// `next/server` y la conexión.
export const auditSeveritySchema = z.enum(["info", "warning", "error"]);

// El parseo vive en `lib/cursor.ts` (puro, verificable con tsx); acá solo se
// convierte su throw en un issue de Zod, que el handler devuelve como 400.
const cursorSchema = z.string().transform((raw, ctx) => {
  try {
    return parseCursor(raw);
  } catch {
    ctx.addIssue({ code: "custom", message: "Cursor inválido" });
    return z.NEVER;
  }
});

export const listAuditLogsQuerySchema = z.object({
  // String libre, no enum: cuando se auditen `product.*` (deuda 004 §11) el
  // endpoint sirve sin tocar el schema (decisión 2).
  action: z.string().trim().max(64).optional(),
  entityType: z.string().trim().max(32).optional(),
  actorId: z.union([z.literal("system"), z.uuid()]).optional(),
  severity: auditSeveritySchema.optional(),
  // `YYYY-MM-DD`, exactamente lo que emite `<input type="date">`.
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: cursorSchema.optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
