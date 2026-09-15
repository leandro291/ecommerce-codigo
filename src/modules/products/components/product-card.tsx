import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/modules/products/components/favorite-button";
import type { ProductListItem } from "@/modules/products/types/product";

type ProductCardProps = {
  product: ProductListItem;
  /** Ancho fijo para el rail horizontal; en grillas se deja fluido. */
  className?: string;
};

export function ProductCard({ product, className }: ProductCardProps) {
  // Un `compareAtPrice` igual o menor al precio no es una oferta: sin badge.
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    // Corazón y "Agregar" son hermanos del <Link>, no hijos: un <button> dentro
    // de un <a> es HTML inválido y rompe el foco por teclado. El <Link> cubre la
    // card y los botones flotan encima; la fila de precio reserva su espacio.
    <article className={`relative flex ${className ?? ""}`}>
      <Link
        href={`/products/${product.slug}`}
        className="flex w-full flex-col overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      >
        <div className="relative aspect-[4/3] bg-card-soft">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 60vw, 240px"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <ImageOff className="size-6" aria-hidden />
            </div>
          )}

          {discount > 0 && (
            <Badge className="absolute top-2 left-2 bg-panel text-foreground shadow-[var(--shadow-soft)]">
              -{discount}%
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="text-xs text-muted-foreground">{product.categoryName}</p>
          <p className="line-clamp-2 text-sm leading-snug font-semibold">
            {product.name}
          </p>
          <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-3 pr-24">
            <span className="font-heading text-base font-semibold">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice !== null && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <FavoriteButton
        productId={product.id}
        className="absolute top-3 right-3 z-10"
      />

      <AddToCartButton
        productId={product.id}
        stock={product.stock}
        className="absolute right-4 bottom-4 z-10"
      />
    </article>
  );
}
