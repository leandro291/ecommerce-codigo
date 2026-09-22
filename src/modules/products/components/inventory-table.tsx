"use client";

import {
  createColumnHelper,
  filterFn_includesString,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable, tableShellFeatures } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AdjustStockDialog } from "@/modules/products/components/adjust-stock-dialog";
import { useInventory } from "@/modules/products/hooks/use-inventory";
import type { InventoryRow } from "@/modules/products/types/product";

const helper = createColumnHelper<typeof tableShellFeatures, InventoryRow>();

// Una referencia nueva por render invalidaría los row models de la tabla.
const EMPTY_INVENTORY: InventoryRow[] = [];

function needsRestock(row: InventoryRow): boolean {
  return row.stock <= row.reorderPoint;
}

type InventoryTableProps = {
  // Solo quita fricción: el handler revalida `inventory.adjust` siempre.
  canAdjust: boolean;
};

export function InventoryTable({ canAdjust }: InventoryTableProps) {
  // "Solo por reponer" va al servidor (la comparación es entre dos columnas);
  // el buscador filtra en cliente, como el resto de las tablas del panel.
  const [onlyLow, setOnlyLow] = useState(false);
  const { data, isPending, isError, error, refetch, isFetching } = useInventory(
    onlyLow ? { onlyLow: true } : {},
  );

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", { header: "Producto" }),
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
        }),
        helper.accessor("stock", { header: "Stock", enableGlobalFilter: false }),
        helper.accessor("reorderPoint", {
          header: "Punto de reposición",
          enableGlobalFilter: false,
        }),
        helper.display({
          id: "restock",
          header: "Reposición",
          cell: ({ row }) =>
            needsRestock(row.original) ? (
              <Badge variant="destructive">Reponer</Badge>
            ) : (
              <Badge variant="secondary">Con stock</Badge>
            ),
        }),
        helper.accessor("isActive", {
          header: "Estado",
          enableGlobalFilter: false,
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
          cell: ({ row }) =>
            canAdjust ? (
              <div className="flex justify-end">
                <AdjustStockDialog
                  row={row.original}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Ajustar
                    </Button>
                  }
                />
              </div>
            ) : null,
        }),
      ]),
    [canAdjust],
  );

  const table = useTable({
    features: tableShellFeatures,
    columns,
    data: data ?? EMPTY_INVENTORY,
    globalFilterFn: filterFn_includesString,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-6">
        <p className="text-sm text-destructive">
          No se pudo cargar el inventario: {error.message}
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
          placeholder="Buscar por producto o SKU…"
          aria-label="Buscar en el inventario"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-xs"
        />

        <label className="flex items-center gap-2 text-sm" htmlFor="only-low">
          <Checkbox
            id="only-low"
            checked={onlyLow}
            onCheckedChange={(checked) => setOnlyLow(checked === true)}
          />
          Solo por reponer
        </label>

        {isFetching && !isPending && (
          <span className="text-xs text-muted-foreground">Actualizando…</span>
        )}
      </div>

      <DataTable
        table={table}
        columnCount={columns.length}
        isPending={isPending}
        emptyMessage={
          onlyLow
            ? "No hay productos por reponer."
            : "No hay productos que coincidan."
        }
      />
    </div>
  );
}
