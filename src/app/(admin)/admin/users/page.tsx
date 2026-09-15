import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requirePanelAccess } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { UserFormDialog } from "@/modules/users/components/user-form-dialog";
import { UsersTable } from "@/modules/users/components/users-table";

export const metadata = {
  title: "Usuarios | Administración",
};

export default async function AdminUsersPage() {
  // `resolvePermissions` está memoizado por request: el layout ya lo resolvió.
  const { permissions } = await requirePanelAccess();

  if (!can(permissions, "users.read")) redirect("/sin-acceso");

  // La UI oculta opciones; la seguridad la decide el handler, que lo revalida.
  const canAssignAdmin = can(permissions, "users.assign_admin");
  const canUpdate = can(permissions, "users.update");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Personas con acceso al panel y sus puestos.
          </p>
        </div>

        <UserFormDialog
          canAssignAdmin={canAssignAdmin}
          trigger={<Button>Invitar persona</Button>}
        />
      </div>

      <UsersTable canAssignAdmin={canAssignAdmin} canUpdate={canUpdate} />
    </div>
  );
}
