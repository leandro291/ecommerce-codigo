import { redirect } from "next/navigation";

import { requirePanelAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { RolesList } from "@/modules/roles/components/roles-list";

export const metadata = {
  title: "Puestos | Administración",
};

export default async function AdminRolesPage() {
  // El layout solo exige `dashboard.read`: esta page repite su propio guard.
  // `resolvePermissions` está memoizado por request, así que no hay query extra.
  const { permissions } = await requirePanelAccess();

  if (!can(permissions, "roles.read")) redirect("/sin-acceso");

  // La UI oculta el botón; la seguridad la decide el PATCH, que lo revalida.
  const canEdit = can(permissions, "roles.update");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Puestos</h1>
        <p className="text-sm text-muted-foreground">
          Qué puede hacer cada puesto dentro del panel.
        </p>
      </div>

      <RolesList canEdit={canEdit} />
    </div>
  );
}
