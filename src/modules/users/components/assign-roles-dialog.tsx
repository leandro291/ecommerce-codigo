"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { assignableRoles, ROLES, type RoleSlug } from "@/lib/rbac-catalog";
import { useAssignRoles } from "@/modules/users/hooks/use-users";
import { assignRolesSchema } from "@/modules/users/schemas/user.schema";
import type { UserWithRoles } from "@/modules/users/types/user";

type AssignRolesDialogProps = {
  trigger: ReactElement;
  user: UserWithRoles;
  canAssignAdmin: boolean;
};

// Del catálogo, no de `user.roles`: así los slugs quedan tipados sin castear.
function currentSlugs(user: UserWithRoles): RoleSlug[] {
  return ROLES.filter((role) =>
    user.roles.some((assigned) => assigned.slug === role.slug),
  ).map((role) => role.slug);
}

export function AssignRolesDialog({
  trigger,
  user,
  canAssignAdmin,
}: AssignRolesDialogProps) {
  const [open, setOpen] = useState(false);
  const assignRoles = useAssignRoles();
  const roles = assignableRoles(canAssignAdmin);

  const { handleSubmit, reset, setValue, control } = useForm({
    resolver: zodResolver(assignRolesSchema),
    defaultValues: { roleSlugs: currentSlugs(user) },
  });

  const selected = useWatch({ control, name: "roleSlugs" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset({ roleSlugs: currentSlugs(user) });
  }

  function toggle(slug: RoleSlug, checked: boolean) {
    setValue(
      "roleSlugs",
      checked
        ? [...selected, slug]
        : selected.filter((current) => current !== slug),
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await assignRoles.mutateAsync({ id: user.id, input: values });
      toast.success("Puestos actualizados");
      setOpen(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudieron actualizar los puestos"),
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Puestos</DialogTitle>
          <DialogDescription>
            Los permisos del panel salen de los puestos asignados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-4">
            {roles.map((role) => (
              <label
                key={role.slug}
                className="flex items-start gap-3"
                htmlFor={`role-${role.slug}`}
              >
                <Checkbox
                  id={`role-${role.slug}`}
                  className="mt-1"
                  checked={selected.includes(role.slug)}
                  onCheckedChange={(checked) => toggle(role.slug, checked)}
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{role.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {role.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={assignRoles.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={assignRoles.isPending}>
              {assignRoles.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
