"use client";

import {
  createColumnHelper,
  filterFn_includesString,
  useTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable, tableShellFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignRolesDialog } from "@/modules/users/components/assign-roles-dialog";
import { DeactivateUserDialog } from "@/modules/users/components/deactivate-user-dialog";
import { EditUserDialog } from "@/modules/users/components/edit-user-dialog";
import { useUsers } from "@/modules/users/hooks/use-users";
import type { UserWithRoles } from "@/modules/users/types/user";

const helper = createColumnHelper<typeof tableShellFeatures, UserWithRoles>();

// Una referencia nueva por render invalidaría los row models de la tabla.
const EMPTY_USERS: UserWithRoles[] = [];

type UsersTableProps = {
  canAssignAdmin: boolean;
  // Solo quita fricción: el handler revalida el permiso siempre (decisión 9).
  canUpdate: boolean;
};

export function UsersTable({ canAssignAdmin, canUpdate }: UsersTableProps) {
  const { data, isPending, isError, error, refetch, isFetching } = useUsers();

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // `canAssignAdmin` viaja hasta el diálogo de puestos, así que las columnas
  // dependen de él: sin el memo se rearman los row models en cada render.
  const columns = useMemo(
    () =>
      helper.columns([
        // `filter(Boolean)` evita que el buscador global matchee "null".
        helper.accessor(
          (row) => [row.firstName, row.lastName].filter(Boolean).join(" "),
          {
            id: "name",
            header: "Nombre",
            cell: ({ cell }) => cell.getValue() || "—",
          },
        ),
        helper.accessor("email", { header: "Email" }),
        helper.display({
          id: "roles",
          header: "Puestos",
          enableSorting: false,
          cell: ({ row }) =>
            row.original.roles.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {row.original.roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            ),
        }),
        helper.accessor("isActive", {
          header: "Estado",
          enableGlobalFilter: false,
          filterFn: (row, columnId, filterValue) =>
            String(row.getValue(columnId)) === filterValue,
          cell: ({ cell }) => (
            <Badge variant={cell.getValue() ? "default" : "secondary"}>
              {cell.getValue() ? "Activa" : "Inactiva"}
            </Badge>
          ),
        }),
        helper.display({
          id: "actions",
          header: "Acciones",
          enableSorting: false,
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              {canUpdate && (
                <EditUserDialog
                  user={row.original}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  }
                />
              )}
              <AssignRolesDialog
                user={row.original}
                canAssignAdmin={canAssignAdmin}
                trigger={
                  <Button variant="ghost" size="sm">
                    Puestos
                  </Button>
                }
              />
              {row.original.isActive && (
                <DeactivateUserDialog
                  user={row.original}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Desactivar
                    </Button>
                  }
                />
              )}
            </div>
          ),
        }),
      ]),
    [canAssignAdmin, canUpdate],
  );

  const table = useTable({
    features: tableShellFeatures,
    columns,
    data: data ?? EMPTY_USERS,
    globalFilterFn: filterFn_includesString,
    state: { globalFilter, columnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const activeFilter =
    (columnFilters.find((filter) => filter.id === "isActive")?.value as
      | string
      | undefined) ?? "all";

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-6">
        <p className="text-sm text-destructive">
          No se pudieron cargar las personas: {error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nombre o email…"
          aria-label="Buscar personas"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-xs"
        />

        <Select
          value={activeFilter}
          onValueChange={(value) =>
            setColumnFilters(
              value && value !== "all" ? [{ id: "isActive", value }] : [],
            )
          }
        >
          <SelectTrigger aria-label="Filtrar por estado" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="true">Activas</SelectItem>
            <SelectItem value="false">Inactivas</SelectItem>
          </SelectContent>
        </Select>

        {isFetching && !isPending && (
          <span className="text-xs text-muted-foreground">Actualizando…</span>
        )}
      </div>

      <DataTable
        table={table}
        columnCount={columns.length}
        isPending={isPending}
        emptyMessage="No hay personas que coincidan."
      />
    </div>
  );
}
