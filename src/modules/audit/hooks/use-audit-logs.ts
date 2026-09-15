"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import * as auditLogService from "@/modules/audit/services/audit-log.service";
import type { AuditLogFilters } from "@/modules/audit/types/audit-log";

export const auditLogsKey = ["audit-logs"] as const;

// Par natural del cursor (decisión 3): "Cargar más" es `fetchNextPage()` y la
// key incluye los filtros, así cambiar uno arranca una lista nueva en vez de
// mezclar cursores de dos consultas distintas.
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useInfiniteQuery({
    queryKey: [...auditLogsKey, filters],
    queryFn: ({ pageParam }) =>
      auditLogService.listAuditLogs({
        ...filters,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
