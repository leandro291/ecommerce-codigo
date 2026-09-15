"use client";

import {
  createColumnHelper,
  filterFn_includesString,
  useTable,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

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
import { CategoryFormDialog } from "@/modules/categories/components/category-form-dialog";
import { DeleteCategoryDialog } from "@/modules/categories/components/delete-category-dialog";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import type { Category } from "@/modules/categories/types/category";

const helper = createColumnHelper<typeof tableShellFeatures, Category>();

const columns = helper.columns([
  helper.accessor("name", { header: "Nombre" }),
  helper.accessor("slug", {
    header: "Slug",
    cell: ({ cell }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {cell.getValue()}
      </span>
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
  helper.accessor("position", {
    header: "Posición",
    enableGlobalFilter: false,
  }),
  helper.display({
    id: "actions",
    header: "Acciones",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <CategoryFormDialog
          category={row.original}
          trigger={
            <Button variant="ghost" size="sm">
              Editar
            </Button>
          }
        />
        <DeleteCategoryDialog
          category={row.original}
          trigger={
            <Button variant="ghost" size="sm">
              Eliminar
            </Button>
          }
        />
      </div>
    ),
  }),
]);

// Una referencia nueva por render invalidaría los row models de la tabla.
const EMPTY_CATEGORIES: Category[] = [];

export function CategoriesTable() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useCategories();

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useTable({
    features: tableShellFeatures,
    columns,
    data: data ?? EMPTY_CATEGORIES,
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
          No se pudieron cargar las categorías: {error.message}
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
          placeholder="Buscar por nombre o slug…"
          aria-label="Buscar categorías"
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
        emptyMessage="No hay categorías que coincidan."
      />
    </div>
  );
}
