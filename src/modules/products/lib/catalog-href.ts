import type { PublicProductQuery } from "@/modules/products/schemas/product.schema";

/** Los tres filtros que viajan en la URL del catálogo. `limit` es fijo. */
export type CatalogQuery = Pick<
  PublicProductQuery,
  "category" | "search" | "sort"
>;

// Único lugar donde se arma la URL del catálogo: los chips (servidor) y el
// selector de orden (cliente) tienen que conservar los mismos parámetros, y con
// dos implementaciones una de las dos termina perdiendo la búsqueda.
// Los valores por defecto no se escriben: `/products` y `/products?sort=relevance`
// son la misma vista y conviene que compartan una sola URL.
// `page` va como segundo argumento y NO dentro de `CatalogQuery` a propósito: los
// chips de categoría y el selector de orden llaman `catalogHref({ ...query })`
// sin él, así que cambiar de filtro devuelve solas a la página 1.
export function catalogHref(
  query: Partial<CatalogQuery>,
  page?: number,
): string {
  const params = new URLSearchParams();

  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (query.sort && query.sort !== "relevance") params.set("sort", query.sort);
  if (page && page > 1) params.set("page", String(page));

  const search = params.toString();

  return search ? `/products?${search}` : "/products";
}
