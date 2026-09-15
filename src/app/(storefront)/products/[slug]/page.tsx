import { ChevronRight, ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { formatPrice } from "@/lib/money";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/modules/products/components/favorite-button";
import * as productRepository from "@/server/repositories/product.repository";

// La ficha es igual para todo visitante y no depende de la sesión.
export const revalidate = 300;

// `generateMetadata` y la página piden el mismo producto: `cache` deja una sola
// consulta por request.
const getProduct = cache(productRepository.findPublicBySlug);

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: "Producto no encontrado" };

  return {
    title: `${product.name} — E-commerce Tech`,
    description: product.description ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  // Slug inexistente o producto dado de baja: para el storefront es lo mismo.
  if (!product) notFound();

  const hasDiscount =
    product.compareAtPrice !== null && product.compareAtPrice > product.price;

  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5">
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
        >
          <Link href="/products" className="hover:text-foreground">
            Catálogo
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span>{product.categoryName}</span>
        </nav>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl border bg-linear-to-br from-card to-card-soft shadow-[var(--shadow-soft)]">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 640px"
                className="object-contain p-8"
              />
            ) : (
              <ImageOff className="size-10 text-muted-foreground" aria-hidden />
            )}
          </div>

          <section className="flex flex-col rounded-3xl border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              {product.categoryName}
            </span>

            <h1 className="mt-4 font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              {product.name}
            </h1>

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="font-heading text-3xl font-semibold">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && product.compareAtPrice !== null && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {product.stock > 0
                ? `${product.stock} en stock`
                : "Sin stock por ahora"}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <AddToCartButton
                productId={product.id}
                stock={product.stock}
                size="lg"
                className="h-12 w-full"
              />
              <div className="flex items-center gap-2">
                <FavoriteButton productId={product.id} />
                <span className="text-xs text-muted-foreground">
                  Guardalo en favoritos
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
