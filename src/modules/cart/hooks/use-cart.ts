"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as cartService from "@/modules/cart/services/cart.service";
import type { CartItem } from "@/modules/cart/types/cart";

export const cartKey = ["cart"] as const;

export function useCart() {
  return useQuery({
    queryKey: cartKey,
    queryFn: () => cartService.listCart(),
  });
}

// Las tres mutaciones devuelven el carrito ya recalculado por el servidor: se
// escribe en la caché en vez de invalidar, así el drawer no parpadea con un
// refetch que traería exactamente lo mismo.
function useCartMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<CartItem[]>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (cart) => queryClient.setQueryData(cartKey, cart),
  });
}

export function useAddToCart() {
  return useCartMutation((productId: string) =>
    cartService.addToCart({ productId }),
  );
}

export function useSetCartQuantity() {
  return useCartMutation(
    ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartService.setCartQuantity(productId, quantity),
  );
}

export function useRemoveFromCart() {
  return useCartMutation((productId: string) =>
    cartService.removeFromCart(productId),
  );
}
