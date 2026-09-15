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
import { formatPrice } from "@/lib/money";
import { useCategories } from "@/modules/categories/hooks/use-categories";
import { DeleteProductDialog } from "@/modules/products/components/delete-product-dialog";
import { ProductFormDialog } from "@/modules/products/components/product-form-dialog";
import { useProducts } from "@/modules/products/hooks/use-products";
import type { ProductListItem } from "@/modules/products/types/product";

const helper = createColumnHelper<typeof tableShellFeatures, ProductListItem>();

const columns = helper.columns([
  helper.accessor("name", { header: "Nombre" }),
  // `?? ""` evita que el buscador global matchee el string "null".
  helper.accessor((row) => row.sku ?? "", {
    id: "sku",
    header: "SKU",
    cell: ({ cell }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {cell.getValue() || "—"}
      </span>
    ),
  }),
  helper.accessor("categoryName", {
    header: "Categoría",
    enableGlobalFilter: false,
    // El <Select> guarda ids (estables) y la tabla muestra nombres.
    filterFn: (row, _columnId, filterValue) =>
      row.original.categoryId === filterValue,
  }),
  helper.accessor("price", {
    header: "Precio",
    enableGlobalFilter: false,
    cell: ({ cell }) => formatPrice(cell.getValue()),
  }),
  helper.accessor("stock", { header: "Stock", enableGlobalFilter: false }),
  helper.accessor("isActive", {
    header: "Estado",
    enableGlobalFilter: false,
    filterFn: (row, columnId, filterValue) =>
      String(row.getValue(columnId)) === filterValue,
    cell: ({ cell }) => (
      <Badge variant={cell.getValue() ? "default" : "secondary"}>
        {cell.getValue() ? "Activo" : "Inactivo"}
      </Badge>
    ),
  }),
  helper.display({
    id: "actions",
    header: "Acciones",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <ProductFormDialog
          product={row.original}
          trigger={
            <Button variant="ghost" size="sm">
              Editar
            </Button>
          }
        />
        <DeleteProductDialog
          product={row.original}
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
const EMPTY_PRODUCTS: ProductListItem[] = [];

export function ProductsTable() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useProducts();
  const { data: categories } = useCategories();

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
    data: data ?? EMPTY_PRODUCTS,
    globalFilterFn: filterFn_includesString,
    state: { globalFilter, columnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  // Cada <Select> toca su propio filtro sin pisar el del otro (AC10).
  function setFilter(id: string, value: string | null) {
    setColumnFilters((current) => {
      const rest = current.filter((filter) => filter.id !== id);
      return !value || value === "all" ? rest : [...rest, { id, value }];
    });
  }

  function filterValue(id: string) {
    return (
      (columnFilters.find((filter) => filter.id === id)?.value as
        | string
        | undefined) ?? "all"
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-6">
        <p className="text-sm text-destructive">
          No se pudieron cargar los productos: {error.message}
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
          placeholder="Buscar por nombre o SKU…"
          aria-label="Buscar productos"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-xs"
        />

        <Select
          value={filterValue("categoryName")}
          onValueChange={(value) => setFilter("categoryName", value)}
        >
          <SelectTrigger aria-label="Filtrar por categoría" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterValue("isActive")}
          onValueChange={(value) => setFilter("isActive", value)}
        >
          <SelectTrigger aria-label="Filtrar por estado" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
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
        emptyMessage="No hay productos que coincidan."
      />
    </div>
  );
}
