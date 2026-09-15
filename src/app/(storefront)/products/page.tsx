import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/shared/reveal";
import { CatalogPagination } from "@/modules/products/components/catalog-pagination";
import { CatalogToolbar } from "@/modules/products/components/catalog-toolbar";
import { CategoryFilters } from "@/modules/products/components/category-filters";
import { ProductCard } from "@/modules/products/components/product-card";
import {
  publicProductQuerySchema,
  type PublicProductQuery,
} from "@/modules/products/schemas/product.schema";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";

export const metadata: Metadata = {
  title: "Catálogo — E-commerce Tech",
  description:
    "Notebooks, monitores, periféricos y audio. Filtrá por categoría, buscá por nombre y ordená por precio.",
};

// Tamaño de página del catálogo. La página lo impone: `limit` del schema sigue
// siendo del consumidor de `/api/products` (autocompletado incluido).
const PAGE_SIZE = 12;

// Fallback cuando la URL trae basura: primera página, sin filtros.
const DEFAULT_QUERY: PublicProductQuery = {
  sort: "relevance",
  limit: PAGE_SIZE,
  page: 1,
};

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

// Server Component: lee el repositorio directo (docs/SETUP.md §4) y el estado de
// los filtros vive en la URL, no en el cliente. `searchParams` la vuelve dinámica,
// así que no lleva `revalidate`.
export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const parsed = publicProductQuerySchema.safeParse(await searchParams);

  // Los parámetros llegan del usuario: uno torcido cae a los defaults en vez de
  // tirar la página abajo. El 400 explícito es cosa de `GET /api/products`.
  const query = parsed.success
    ? { ...parsed.data, limit: PAGE_SIZE }
    : DEFAULT_QUERY;

  // En serie y no en paralelo con la lista: sin el total no se puede recortar la
  // página pedida, y `?page=999` devolvería una grilla vacía que habría que
  // volver a consultar. Un roundtrip extra sale más barato que la corrección.
  const [total, categories] = await Promise.all([
    productRepository.countPublic(query),
    categoryRepository.list({ isActive: true }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp y no `redirect()`: `?page=999` muestra la última página válida con la
  // URL tal cual llegó, sin una navegación extra ni un bucle potencial.
  const currentPage = Math.min(Math.max(query.page, 1), totalPages);

  const products = await productRepository.listPublic({
    ...query,
    page: currentPage,
  });

  const isFiltered = Boolean(query.category || query.search);

  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Catálogo
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isFiltered
              ? plural(total, "resultado")
              : plural(total, "producto")}
          </p>
        </div>

        <CatalogToolbar query={query} />

        {/* El catálogo (filtros de categoría + orden) a la izquierda, los
            productos a la derecha; en mobile/tablet se apila igual que antes,
            filtros arriba de la grilla. */}
        <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-start">
          <CategoryFilters categories={categories} query={query} />

          <div className="flex flex-col gap-4">
            {products.length > 0 ? (
              <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Reveal>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-14 text-center">
                <p className="text-sm text-muted-foreground">
                  {isFiltered
                    ? "No encontramos productos con esos filtros."
                    : "Todavía no hay productos publicados."}
                </p>
                {isFiltered && (
                  <Link
                    href="/products"
                    className="inline-flex items-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition duration-200 hover:-translate-y-0.5"
                  >
                    Limpiar filtros
                  </Link>
                )}
              </div>
            )}

            <CatalogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              query={query}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
