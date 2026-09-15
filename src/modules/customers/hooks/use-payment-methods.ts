"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-error";
import * as paymentMethodService from "@/modules/customers/services/payment-method.service";

export const paymentMethodsKey = ["payment-methods"] as const;

export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentMethodsKey,
    queryFn: paymentMethodService.listPaymentMethods,
    // El usuario vuelve de Stripe antes de que llegue el webhook: con el
    // `staleTime` global de 60 s vería su lista vieja al montar la tab.
    staleTime: 0,
  });
}

export function useAddCard() {
  return useMutation({
    mutationFn: paymentMethodService.startCardSetup,
    // `window.location`, no `router.push`: el destino es checkout.stripe.com,
    // fuera de la app.
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo agregar la tarjeta"));
    },
  });
}

export function useRemoveCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentMethodService.deletePaymentMethod,
    onSuccess: () => {
      toast.success("Tarjeta eliminada");
      queryClient.invalidateQueries({ queryKey: paymentMethodsKey });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la tarjeta"));
    },
  });
}
