import { api } from "@/lib/axios";

// Sin body: el carrito que se cobra es el del servidor, no el de la caché.
export async function startCheckout(): Promise<string> {
  const { data } = await api.post<{ url: string }>("/checkout");
  return data.url;
}
