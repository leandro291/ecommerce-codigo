import { api } from "@/lib/axios";
import type {
  AuditLogFilters,
  AuditLogsPage,
} from "@/modules/audit/types/audit-log";

const BASE_URL = "/admin/audit-logs";

// El `cursor` no viene de la barra de filtros: lo pone el hook desde el
// `pageParam` de `useInfiniteQuery`.
export async function listAuditLogs(
  query: AuditLogFilters & { cursor?: string } = {},
): Promise<AuditLogsPage> {
  const { data } = await api.get<AuditLogsPage>(BASE_URL, { params: query });
  return data;
}
