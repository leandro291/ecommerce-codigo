import { NextResponse, type NextRequest } from "next/server";

import { toDateRange } from "@/lib/date-range";
import { requirePermission } from "@/lib/permissions";
import { listAuditLogsQuerySchema } from "@/modules/audit/schemas/audit-log.schema";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

// La bitácora no expone ningún otro método: `audit_logs` es append-only y este
// archivo no exporta POST/PATCH/DELETE, así que Next responde 405 solo.
export async function GET(request: NextRequest) {
  const guard = await requirePermission("audit_logs.read");

  if (!guard.ok) return guard.response;

  const query = listAuditLogsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  // Día completo en UTC: la bitácora no recibe `tzOffset` (decisión 8).
  const range = toDateRange(query.data.from, query.data.to);

  try {
    const page = await auditLogRepository.list({
      action: query.data.action,
      entityType: query.data.entityType,
      actorId: query.data.actorId,
      severity: query.data.severity,
      from: range.from,
      to: range.to,
      limit: query.data.limit,
      cursor: query.data.cursor,
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error("GET /api/admin/audit-logs", error);
    return NextResponse.json(
      { error: "No se pudo obtener la bitácora" },
      { status: 500 },
    );
  }
}
