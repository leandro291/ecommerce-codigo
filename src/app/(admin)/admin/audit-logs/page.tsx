import { redirect } from "next/navigation";

import { requirePanelAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AuditLogsTable } from "@/modules/audit/components/audit-logs-table";

export const metadata = {
  title: "Auditoría | Administración",
};

export default async function AdminAuditLogsPage() {
  // El layout solo exige `dashboard.read`: esta page repite su propio guard.
  // `resolvePermissions` está memoizado por request, así que no hay query extra.
  const { permissions } = await requirePanelAccess();

  if (!can(permissions, "audit_logs.read")) redirect("/sin-acceso");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Traza de los cambios sensibles del panel. Es una foto: los eventos que
          entran mientras paginás aparecen al recargar.
        </p>
      </div>

      <AuditLogsTable />
    </div>
  );
}
