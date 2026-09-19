import { redirect } from "next/navigation";

import { requirePanelAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AdminOrdersTable } from "@/modules/orders/components/admin-orders-table";

export const metadata = {
  title: "Pedidos | Administración",
};

export default async function AdminOrdersPage() {
  // El layout solo exige `dashboard.read`: esta page repite su propio guard.
  // `resolvePermissions` está memoizado por request, así que no hay query extra.
  const { permissions } = await requirePanelAccess();

  if (!can(permissions, "orders.read")) redirect("/sin-acceso");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Todos los pedidos, incluidos los que no llegaron a pagarse. Es una
          foto: los que entran mientras paginás aparecen al recargar.
        </p>
      </div>

      <AdminOrdersTable />
    </div>
  );
}
