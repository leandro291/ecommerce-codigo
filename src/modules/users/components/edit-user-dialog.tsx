"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { useUpdateUser } from "@/modules/users/hooks/use-users";
import {
  updateUserSchema,
  type UpdateUserInput,
} from "@/modules/users/schemas/user.schema";
import type { UserWithRoles } from "@/modules/users/types/user";

type EditUserDialogProps = {
  trigger: ReactElement;
  user: UserWithRoles;
};

function toDefaults(user: UserWithRoles): UpdateUserInput {
  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  };
}

export function EditUserDialog({ trigger, user }: EditUserDialogProps) {
  const [open, setOpen] = useState(false);
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(updateUserSchema),
    defaultValues: toDefaults(user),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(user));
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateUser.mutateAsync({ id: user.id, input: values });
      toast.success("Datos actualizados");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar persona</DialogTitle>
          <DialogDescription>
            El email lo administra Clerk y no se edita desde acá.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-user-email">Email</FieldLabel>
              <Input id="edit-user-email" value={user.email} readOnly disabled />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-user-first-name">Nombre</FieldLabel>
              <Input id="edit-user-first-name" {...register("firstName")} />
              <FieldError errors={[errors.firstName]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-user-last-name">Apellido</FieldLabel>
              <Input id="edit-user-last-name" {...register("lastName")} />
              <FieldError errors={[errors.lastName]} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateUser.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
