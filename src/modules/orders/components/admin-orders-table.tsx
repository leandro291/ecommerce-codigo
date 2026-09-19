"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/order-status";
import { AdminOrdersFilters } from "@/modules/orders/components/admin-orders-filters";
import { useAdminOrders } from "@/modules/orders/hooks/use-admin-orders";
import type {
  AdminOrderFilters,
  OrderCustomer,
} from "@/modules/orders/types/order";

const COLUMN_COUNT = 4;
const DEBOUNCE_MS = 300;

// `firstName`/`lastName` son nullable: si no hay ninguno, la fila se identifica
// por el email, que sí es obligatorio.
function fullName(customer: OrderCustomer): string | null {
  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ");

  return name || null;
}

export function AdminOrdersTable() {
  const [filters, setFilters] = useState<AdminOrderFilters>({});

  // Solo el texto se retrasa (AC4): las fechas y el estado aplican al instante.
  // El objeto cambia de identidad en cada tecla pero la `queryKey` se compara
  // por valor, así que no hay consulta hasta que el texto se asienta.
  const search = useDebouncedValue(filters.search?.trim() ?? "", DEBOUNCE_MS);
  const query = useMemo(
    () => ({ ...filters, search: search || undefined }),
    [filters, search],
  );

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminOrders(query);

  const rows = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <AdminOrdersFilters value={filters} onChange={setFilters} />

      {isError ? (
        <div className="border-destructive/40 flex flex-col items-start gap-3 rounded-lg border p-6">
          <p className="text-destructive text-sm">
            No se pudieron cargar los pedidos: {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPending ? (
                  Array.from({ length: 8 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={COLUMN_COUNT}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="text-muted-foreground py-8 text-center text-sm"
                    >
                      No hay pedidos que coincidan.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((order) => {
                    const name = fullName(order.customer);

                    return (
                      <TableRow key={order.id}>
                        {/* Llega como string por JSON: se envuelve antes de formatear. */}
                        <TableCell>
                          {new Date(order.createdAt).toLocaleString("es-PE")}
                        </TableCell>

                        <TableCell>
                          <span className="flex flex-col">
                            {name ? <span>{name}</span> : null}
                            <span
                              className={
                                name
                                  ? "text-muted-foreground text-xs"
                                  : undefined
                              }
                            >
                              {order.customer.email}
                            </span>
                          </span>
                        </TableCell>

                        <TableCell>
                          {/* El color nunca viaja solo: la etiqueta lo acompaña (AC6). */}
                          <Badge className={ORDER_STATUS_BADGE[order.status]}>
                            {ORDER_STATUS_LABEL[order.status]}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap">
                          {formatPrice(order.totalAmount)}{" "}
                          <span className="text-muted-foreground text-xs">
                            {order.currency.toUpperCase()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
