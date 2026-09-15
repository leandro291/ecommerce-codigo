import { ArrowRight, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/money";
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button";
import { FavoriteButton } from "@/modules/products/components/favorite-button";
import type { ProductListItem } from "@/modules/products/types/product";

// Puntos flotantes del diseño. Estáticos: son decoración, no dependen del dato.
const DOTS = [
  "top-[6%] left-[18%] size-3 bg-brand [animation-delay:0s]",
  "top-[24%] right-[6%] size-2 bg-muted-foreground [animation-delay:.8s]",
  "bottom-[30%] left-[4%] size-2.5 bg-muted-foreground [animation-delay:1.6s]",
  "right-[20%] bottom-[12%] size-[7px] bg-brand [animation-delay:2.2s]",
  "top-[50%] right-0 size-2.5 bg-muted-foreground [animation-delay:1.1s]",
];

export function HeroProduct({ product }: { product: ProductListItem }) {
  return (
    <section className="h-full overflow-hidden rounded-3xl border bg-card shadow-[var(--shadow-soft)] transition duration-200 hover:shadow-[var(--shadow-lift)]">
      <div className="grid h-full min-h-0 gap-6 rounded-3xl bg-linear-to-br from-card to-card-soft p-6 sm:p-7 md:grid-cols-[1fr_auto] lg:gap-4 lg:p-5 xl:p-6">
        <div className="flex min-h-0 flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            {product.categoryName}
          </span>

          <h1 className="mt-5 font-heading text-4xl leading-none font-bold tracking-tight text-balance sm:text-5xl lg:mt-3 lg:text-4xl xl:text-5xl">
            {product.name}
          </h1>

          <div className="mt-6 flex items-center gap-4 lg:mt-4">
            <span className="font-heading text-xl font-medium text-muted-foreground/50">
              01
            </span>
            <span className="h-px w-12 bg-border" aria-hidden />
            <div>
              <p className="text-[13px] font-semibold">Envío exprés</p>
              <p className="max-w-[190px] text-xs leading-snug text-muted-foreground">
                Recibilo en 24–48 h con seguimiento en vivo.
              </p>
            </div>
          </div>

          {product.description && (
            <p className="mt-5 line-clamp-2 max-w-md text-sm leading-relaxed text-muted-foreground lg:mt-3">
              {product.description}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-6 lg:pt-4">
            <span className="font-heading text-xl font-semibold">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice !== null && (
              <span className="text-[13px] text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 lg:mt-3">
            <Link
              href={`/products/${product.slug}`}
              className="inline-flex w-fit items-center gap-3 rounded-full bg-brand py-1.5 pr-2 pl-5 text-sm font-semibold text-brand-foreground transition duration-200 hover:-translate-y-0.5"
            >
              Ver producto
              <span className="grid size-8 place-items-center rounded-full bg-brand-foreground text-brand">
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>

            <AddToCartButton productId={product.id} stock={product.stock} />

            <FavoriteButton productId={product.id} />
          </div>
        </div>

        <div className="relative grid w-full place-items-center self-center md:w-[320px]">
          {DOTS.map((dot) => (
            <span
              key={dot}
              className={`absolute animate-pulse rounded-full motion-reduce:animate-none ${dot}`}
              aria-hidden
            />
          ))}

          <span
            className="absolute size-3/4 rounded-full bg-brand opacity-20 blur-3xl"
            aria-hidden
          />

          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={262}
              height={262}
              priority
              className="relative w-full max-w-[262px] rounded-[20px] shadow-[var(--shadow-lift)]"
            />
          ) : (
            <div className="relative grid aspect-square w-full max-w-[262px] place-items-center rounded-[20px] bg-card-soft text-muted-foreground">
              <ImageOff className="size-10" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
