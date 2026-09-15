"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles } from "@/modules/roles/hooks/use-roles";
import {
  actionLabel,
  groupByResource,
} from "@/modules/roles/lib/permission-groups";
import { RolePermissionsDialog } from "@/modules/roles/components/role-permissions-dialog";
import type { Permission, RoleWithPermissions } from "@/modules/roles/types/role";

// El Dueño hereda todo el catálogo: su matriz no se edita (409 en el handler).
const OWNER_ROLE_SLUG = "super_admin";

type RolesListProps = {
  canEdit: boolean;
};

// "Productos: ver, crear, editar" — nunca un `code`.
function summarize(
  role: RoleWithPermissions,
  permissions: Permission[],
): string[] {
  const owned = new Set<string>(role.permissionCodes);

  return groupByResource(
    permissions.filter((permission) => owned.has(permission.code)),
  ).map(
    (group) =>
      `${group.label}: ${group.permissions
        .map((permission) => actionLabel(permission.action))
        .join(", ")}`,
  );
}

export function RolesList({ canEdit }: RolesListProps) {
  const { data, isPending, isError, error, refetch } = useRoles();

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-6">
        <p className="text-sm text-destructive">
          No se pudieron cargar los puestos: {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (data.roles.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-sm text-muted-foreground">
        No hay puestos cargados. Falta correr <code>npm run db:seed</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.roles.map((role) => {
        const isOwner = role.slug === OWNER_ROLE_SLUG;
        const lines = summarize(role, data.permissions);

        return (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle>{role.name}</CardTitle>
              {role.description ? (
                <CardDescription>{role.description}</CardDescription>
              ) : null}

              <CardAction>
                {isOwner ? (
                  <Badge variant="secondary">Todos los permisos</Badge>
                ) : canEdit ? (
                  <RolePermissionsDialog
                    role={role}
                    permissions={data.permissions}
                    trigger={
                      <Button variant="outline" size="sm">
                        Editar permisos
                      </Button>
                    }
                  />
                ) : (
                  <Badge variant="outline">Solo el Dueño puede editar</Badge>
                )}
              </CardAction>
            </CardHeader>

            <CardContent>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin permisos asignados.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
