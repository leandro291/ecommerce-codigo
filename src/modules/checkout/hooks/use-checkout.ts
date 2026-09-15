"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage, isConflict } from "@/lib/api-error";
import { cartKey } from "@/modules/cart/hooks/use-cart";
import * as checkoutService from "@/modules/checkout/services/checkout.service";

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkoutService.startCheckout,
    // `window.location`, no `router.push`: el destino es checkout.stripe.com,
    // fuera de la app.
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar el pago"));

      // 409 = el carrito ya no es el que se ve en pantalla: refrescarlo es
      // parte del mensaje.
      if (isConflict(error)) {
        queryClient.invalidateQueries({ queryKey: cartKey });
      }
    },
  });
}
