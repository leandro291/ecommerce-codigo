import { api } from "@/lib/axios";
import type { AddToCartInput } from "@/modules/cart/schemas/cart.schema";
import type { CartItem } from "@/modules/cart/types/cart";

const BASE_URL = "/cart";

// Los cuatro endpoints devuelven el carrito completo: el hook se queda con esa
// respuesta y no dispara un refetch extra.
export async function listCart(): Promise<CartItem[]> {
  const { data } = await api.get<CartItem[]>(BASE_URL);
  return data;
}

export async function addToCart(input: AddToCartInput): Promise<CartItem[]> {
  const { data } = await api.post<CartItem[]>(BASE_URL, input);
  return data;
}

export async function setCartQuantity(
  productId: string,
  quantity: number,
): Promise<CartItem[]> {
  const { data } = await api.patch<CartItem[]>(`${BASE_URL}/${productId}`, {
    quantity,
  });
  return data;
}

export async function removeFromCart(productId: string): Promise<CartItem[]> {
  const { data } = await api.delete<CartItem[]>(`${BASE_URL}/${productId}`);
  return data;
}
