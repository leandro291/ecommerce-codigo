import type { Metadata } from "next";

import { Reveal } from "@/components/shared/reveal";
import { CategoryTiles } from "@/modules/categories/components/category-tiles";
import { HeroProduct } from "@/modules/products/components/hero-product";
import { ProductRail } from "@/modules/products/components/product-rail";
import * as categoryRepository from "@/server/repositories/category.repository";
import * as productRepository from "@/server/repositories/product.repository";

// Lectura inicial con SEO: Server Component → repositorio, sin pasar por /api
// (docs/SETUP.md §4). No hay dato por usuario, así que se revalida cada 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "E-commerce Tech — Tecnología que se siente",
  description:
    "Notebooks, monitores, periféricos y audio. Envío exprés en 24–48 h con seguimiento en vivo.",
};

// Lote del que salen hero y destacado; alcanza para el catálogo sembrado.
const POOL_LIMIT = 24;

export default async function LandingPage() {
  const [pool, categories] = await Promise.all([
    productRepository.listPublic({ limit: POOL_LIMIT }),
    categoryRepository.list({ isActive: true }),
  ]);

  // `listPublic` ordena `desc(isFeatured)` primero: el destacado, si existe, encabeza.
  const hero = pool.at(0);
  const [priciest] = pool
    .filter((product) => product.id !== hero?.id)
    .sort((a, b) => b.price - a.price);
  const railProduct = priciest ?? hero;

  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5 lg:h-full lg:min-h-0">
        {hero ? (
          <div className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[1.62fr_1fr] lg:grid-rows-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Reveal className="lg:col-start-1 lg:row-start-1 lg:min-h-0">
              <HeroProduct product={hero} />
            </Reveal>

            {railProduct && (
              <Reveal
                delay={0.06}
                className="min-h-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"
              >
                <ProductRail product={railProduct} />
              </Reveal>
            )}

            {categories.length > 0 && (
              <Reveal
                delay={0.12}
                className="lg:col-start-1 lg:row-start-2 lg:min-h-0"
              >
                <CategoryTiles categories={categories} />
              </Reveal>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-3xl border bg-card px-6 py-20 text-center">
            <h1 className="font-heading text-xl font-semibold">
              Todavía no hay productos publicados
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              El catálogo está vacío o sin productos activos. Volvé en un rato.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
