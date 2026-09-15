"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import type { OrderRangeQuery } from "@/modules/orders/schemas/order.schema";
import * as orderService from "@/modules/orders/services/order.service";

// El rango entra en la key: cambiarlo es otra consulta, no un refetch de la
// misma. El prefijo "orders" sirve para invalidar todas de una.
export function ordersKey(range: OrderRangeQuery) {
  return ["orders", range] as const;
}

// `enabled` lo decide quien llama: con un rango inválido no se dispara consulta.
export function useOrders(range: OrderRangeQuery, enabled = true) {
  return useQuery({
    queryKey: ordersKey(range),
    queryFn: () => orderService.listOrders(range),
    enabled,
  });
}

// La boleta no se cachea: el `receipt_url` viene firmado por Stripe y se pide de
// nuevo en cada click. Por eso es mutación y no query.
export function useReceipt() {
  return useMutation({
    mutationFn: orderService.getReceiptUrl,
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo abrir la boleta"));
    },
  });
}
