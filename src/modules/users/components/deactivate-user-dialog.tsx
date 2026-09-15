"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useDeactivateUser } from "@/modules/users/hooks/use-users";
import type { UserWithRoles } from "@/modules/users/types/user";

type DeactivateUserDialogProps = {
  trigger: ReactElement;
  user: UserWithRoles;
};

export function DeactivateUserDialog({
  trigger,
  user,
}: DeactivateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const deactivateUser = useDeactivateUser();

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  async function handleDeactivate() {
    try {
      await deactivateUser.mutateAsync(user.id);
      toast.success("Persona desactivada");
      setOpen(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudo desactivar la persona"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desactivar persona</DialogTitle>
          <DialogDescription>
            Se va a desactivar a «{name}». La persona pierde el acceso al panel
            de inmediato y no se puede reactivar desde acá.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deactivateUser.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeactivate}
            disabled={deactivateUser.isPending}
          >
            {deactivateUser.isPending ? "Desactivando…" : "Desactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
