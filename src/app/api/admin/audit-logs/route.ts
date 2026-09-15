import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { listAuditLogsQuerySchema } from "@/modules/audit/schemas/audit-log.schema";
import * as auditLogRepository from "@/server/repositories/audit-log.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

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

  try {
    const page = await auditLogRepository.list({
      action: query.data.action,
      entityType: query.data.entityType,
      actorId: query.data.actorId,
      severity: query.data.severity,
      // Día completo en UTC: el "hasta" es inclusivo, así que se compara contra
      // el arranque del día siguiente (decisión 8).
      from: query.data.from ? startOfDayUtc(query.data.from) : undefined,
      to: query.data.to
        ? new Date(startOfDayUtc(query.data.to).getTime() + DAY_MS)
        : undefined,
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
