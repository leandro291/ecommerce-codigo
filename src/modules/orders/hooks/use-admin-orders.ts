"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import * as adminOrderService from "@/modules/orders/services/admin-order.service";
import type { AdminOrderFilters } from "@/modules/orders/types/order";

export const adminOrdersKey = ["admin-orders"] as const;

// Par natural del cursor (009 decisión 3): "Cargar más" es `fetchNextPage()` y
// la key incluye los filtros, así cambiar uno arranca una lista nueva en vez de
// mezclar cursores de dos consultas distintas.
//
// El `tzOffset` lo agrega el hook y no la barra de filtros (mismo criterio que
// `useMetrics`): quien filtra elige `YYYY-MM-DD` y el huso es del navegador.
// Va en la key porque mueve los bordes del rango en el servidor (AC3).
export function useAdminOrders(filters: AdminOrderFilters = {}) {
  const query = { ...filters, tzOffset: new Date().getTimezoneOffset() };

  return useInfiniteQuery({
    queryKey: [...adminOrdersKey, query],
    queryFn: ({ pageParam }) =>
      adminOrderService.listAdminOrders({
        ...query,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
