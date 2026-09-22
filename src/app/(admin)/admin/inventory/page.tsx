import { redirect } from "next/navigation";

import { requirePanelAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InventoryTable } from "@/modules/products/components/inventory-table";

export const metadata = {
  title: "Inventario | Administración",
};

export default async function AdminInventoryPage() {
  // El layout solo exige `dashboard.read`: esta page repite su propio guard.
  // `resolvePermissions` está memoizado por request, así que no hay query extra.
  const { permissions } = await requirePanelAccess();

  if (!can(permissions, "inventory.read")) redirect("/sin-acceso");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Stock y punto de reposición de cada producto. Se marca «Reponer»
          cuando el stock llega al punto de reposición.
        </p>
      </div>

      <InventoryTable canAdjust={can(permissions, "inventory.adjust")} />
    </div>
  );
}
