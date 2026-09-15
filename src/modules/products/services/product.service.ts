import { api } from "@/lib/axios";
import { toCents } from "@/lib/money";
import type {
  CreateProductInput,
  ProductFormValues,
  PublicProductQuery,
} from "@/modules/products/schemas/product.schema";
import type {
  Product,
  ProductListItem,
} from "@/modules/products/types/product";

const BASE_URL = "/admin/products";

// Borde exacto donde el formulario deja de ser formulario: los soles con
// decimales se vuelven centavos enteros antes de salir a la red.
export function toPayload(input: ProductFormValues): CreateProductInput {
  return {
    ...input,
    price: toCents(input.price),
    compareAtPrice:
      input.compareAtPrice == null
        ? input.compareAtPrice
        : toCents(input.compareAtPrice),
  };
}

export async function listProducts(): Promise<ProductListItem[]> {
  const { data } = await api.get<ProductListItem[]>(BASE_URL);
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`${BASE_URL}/${id}`);
  return data;
}

export async function createProduct(
  input: ProductFormValues,
): Promise<Product> {
  const { data } = await api.post<Product>(BASE_URL, toPayload(input));
  return data;
}

export async function updateProduct(
  id: string,
  input: ProductFormValues,
): Promise<Product> {
  const { data } = await api.patch<Product>(
    `${BASE_URL}/${id}`,
    toPayload(input),
  );
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}

type SearchPublicProductsParams = Pick<
  PublicProductQuery,
  "search" | "category" | "limit"
> & {
  /** El `signal` que TanStack Query pasa al `queryFn`: aborta la petición vieja. */
  signal?: AbortSignal;
};

// Catálogo público (`GET /api/products`), no `/admin/products`: es la misma
// lista que ya sirve la grilla, con `limit` recortado para el autocompletado.
export async function searchPublicProducts({
  signal,
  ...params
}: SearchPublicProductsParams): Promise<ProductListItem[]> {
  const { data } = await api.get<ProductListItem[]>("/products", {
    params,
    signal,
  });

  return data;
}
