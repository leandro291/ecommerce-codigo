"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import type { PermissionCode } from "@/lib/rbac-catalog";
import { useUpdateRolePermissions } from "@/modules/roles/hooks/use-roles";
import { groupByResource } from "@/modules/roles/lib/permission-groups";
import type { Permission, RoleWithPermissions } from "@/modules/roles/types/role";

const PANEL_PERMISSION = "dashboard.read";

type RolePermissionsDialogProps = {
  trigger: ReactElement;
  role: RoleWithPermissions;
  permissions: Permission[];
};

export function RolePermissionsDialog({
  trigger,
  role,
  permissions,
}: RolePermissionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PermissionCode[]>(
    role.permissionCodes,
  );
  const updatePermissions = useUpdateRolePermissions();
  const groups = groupByResource(permissions);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Al abrir, la foto vuelve a ser la del servidor: nada de arrastrar una
    // edición cancelada.
    if (next) setSelected(role.permissionCodes);
  }

  function toggle(code: PermissionCode, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...current, code]
        : current.filter((selectedCode) => selectedCode !== code),
    );
  }

  // El handler no lo impide (decisión 7): es una decisión del Dueño, pero tiene
  // que verla antes de guardar.
  const losesPanel =
    role.permissionCodes.includes(PANEL_PERMISSION) &&
    !selected.includes(PANEL_PERMISSION);

  async function handleSave() {
    try {
      await updatePermissions.mutateAsync({
        id: role.id,
        permissionCodes: selected,
      });
      toast.success(`Permisos de ${role.name} actualizados`);
      setOpen(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudieron actualizar los permisos"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permisos de {role.name}</DialogTitle>
          <DialogDescription>
            Marcá lo que este puesto puede hacer. El cambio afecta a todas las
            personas que lo tengan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto">
          {groups.map((group) => (
            <fieldset key={group.resource} className="flex flex-col gap-3">
              <legend className="text-sm font-medium">{group.label}</legend>

              {group.permissions.map((permission) => {
                const code = permission.code as PermissionCode;

                return (
                  <label
                    key={permission.id}
                    className="flex items-start gap-3"
                    htmlFor={`permission-${permission.id}`}
                  >
                    <Checkbox
                      id={`permission-${permission.id}`}
                      className="mt-0.5"
                      checked={selected.includes(code)}
                      onCheckedChange={(checked) => toggle(code, checked)}
                    />
                    <span className="text-sm">
                      {permission.description ?? code}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        {losesPanel ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            Sin “Acceder al panel de administración”, nadie con el puesto{" "}
            {role.name} va a poder entrar al panel.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updatePermissions.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updatePermissions.isPending}
          >
            {updatePermissions.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
