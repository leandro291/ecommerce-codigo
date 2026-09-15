"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage, isConflict } from "@/lib/api-error";
import { assignableRoles } from "@/lib/rbac-catalog";
import { useCreateUser } from "@/modules/users/hooks/use-users";
import {
  createUserSchema,
  type CreateUserInput,
} from "@/modules/users/schemas/user.schema";

type UserFormDialogProps = {
  trigger: ReactElement;
  // Lo calcula la page en el servidor; el handler lo vuelve a validar siempre.
  canAssignAdmin: boolean;
};

type Credentials = { email: string; temporaryPassword: string };

// Menor privilegio por defecto: el operador elige explícitamente si sube.
const DEFAULTS: CreateUserInput = {
  email: "",
  firstName: "",
  lastName: "",
  roleSlug: "employee",
};

export function UserFormDialog({
  trigger,
  canAssignAdmin,
}: UserFormDialogProps) {
  const [open, setOpen] = useState(false);
  // Solo en memoria: la contraseña no se persiste ni se puede recuperar.
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const createUser = useCreateUser();
  const roles = assignableRoles(canAssignAdmin);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULTS,
  });

  const roleSlug = useWatch({ control, name: "roleSlug" });

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      // Al cerrar se borra: no hay forma de volver a ver la contraseña.
      setCredentials(null);
      reset(DEFAULTS);
    }
  }

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Contraseña copiada");
    } catch {
      toast.error("No se pudo copiar: seleccionala y copiala a mano");
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createUser.mutateAsync(values);

      setCredentials({
        email: created.user.email,
        temporaryPassword: created.temporaryPassword,
      });
    } catch (error) {
      if (isConflict(error)) {
        setError("email", { message: "Ya existe una persona con ese email" });
        return;
      }

      toast.error(getApiErrorMessage(error, "No se pudo crear la persona"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>Persona creada</DialogTitle>
              <DialogDescription>
                Entregale estas credenciales. La contraseña no se vuelve a
                mostrar: si cerrás este diálogo sin copiarla, se pierde.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-sm">{credentials.email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Contraseña temporal
                </p>
                <p className="font-mono text-sm break-all">
                  {credentials.temporaryPassword}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => copyPassword(credentials.temporaryPassword)}
              >
                Copiar contraseña
              </Button>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invitar persona</DialogTitle>
              <DialogDescription>
                Se crea la cuenta en Clerk con una contraseña temporal que se
                muestra una sola vez.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="user-email">Email</FieldLabel>
                  <Input
                    id="user-email"
                    type="email"
                    autoComplete="off"
                    {...register("email")}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-first-name">Nombre</FieldLabel>
                  <Input id="user-first-name" {...register("firstName")} />
                  <FieldError errors={[errors.firstName]} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="user-last-name">Apellido</FieldLabel>
                  <Input id="user-last-name" {...register("lastName")} />
                  <FieldError errors={[errors.lastName]} />
                </Field>

                <Field>
                  <FieldLabel>Puesto</FieldLabel>
                  <Select
                    value={roleSlug}
                    onValueChange={(value) =>
                      setValue("roleSlug", value as CreateUserInput["roleSlug"])
                    }
                  >
                    <SelectTrigger aria-label="Puesto" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.slug} value={role.slug}>
                          <span className="flex flex-col">
                            <span>{role.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.roleSlug]} />
                </Field>
              </FieldGroup>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={createUser.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? "Creando…" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
