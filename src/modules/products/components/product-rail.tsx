import { ArrowUpRight, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/modules/products/components/favorite-button";
import type { ProductListItem } from "@/modules/products/types/product";

// Card-imagen full-bleed del diseño (Main.dc.html, bloque `.rail`): una sola
// pieza, sin lista ni carrusel, así que sigue siendo Server Component.
export function ProductRail({ product }: { product: ProductListItem }) {
  const hasImage = Boolean(product.imageUrl);

  return (
    <section
      aria-labelledby="rail-heading"
      className="relative flex h-full min-h-0 flex-col"
    >
      <h2 id="rail-heading" className="sr-only">
        Destacados
      </h2>

      <Link
        href={`/products/${product.slug}`}
        className="relative flex min-h-[210px] flex-1 flex-col overflow-hidden rounded-3xl border bg-card p-5 shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      >
        {product.imageUrl ? (
          <>
            <Image
              src={product.imageUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 480px"
              className="object-cover"
            />
            <span
              className="absolute inset-0 bg-linear-to-t from-black/65 to-black/5"
              aria-hidden
            />
          </>
        ) : (
          <span
            className="absolute inset-0 grid place-items-center bg-card-soft text-muted-foreground"
            aria-hidden
          >
            <ImageOff className="size-10" />
          </span>
        )}

        <ArrowUpRight
          className={`relative ml-auto size-4 ${hasImage ? "text-white/80" : "text-muted-foreground"}`}
          aria-hidden
        />

        <div className={`relative mt-auto ${hasImage ? "text-white" : ""}`}>
          <p className="text-sm font-semibold">{product.name}</p>
          <p
            className={`line-clamp-1 text-xs ${hasImage ? "opacity-80" : "text-muted-foreground"}`}
          >
            {product.description ?? product.categoryName}
          </p>
        </div>
      </Link>

      {/* Fuera del <Link> (HTML inválido anidar botón en enlace) y a la izquierda
          para no chocar con la flecha del ángulo superior derecho. */}
      <FavoriteButton
        productId={product.id}
        className="absolute top-5 left-5 z-10"
      />
    </section>
  );
}
