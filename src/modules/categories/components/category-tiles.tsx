import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Category } from "@/modules/categories/types/category";

export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <section
      aria-labelledby="categories-heading"
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <h2
        id="categories-heading"
        className="font-heading text-sm font-semibold tracking-tight"
      >
        Categorías
      </h2>

      {/* En desktop los tiles van en una sola fila (bento de una pantalla); si
          entran más categorías de las que caben, scrollean en horizontal. */}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:min-h-0 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-[minmax(150px,1fr)] lg:overflow-x-auto">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/products?category=${category.slug}`}
              className="relative flex h-full min-h-[130px] flex-col overflow-hidden rounded-3xl border bg-card p-4 shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
            >
              {category.imageUrl && (
                <>
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 45vw, 220px"
                    className="object-cover"
                  />
                  <span
                    className="absolute inset-0 bg-linear-to-t from-black/65 to-black/5"
                    aria-hidden
                  />
                </>
              )}

              <ArrowUpRight
                className={`relative ml-auto size-4 ${category.imageUrl ? "text-white/80" : "text-muted-foreground"}`}
                aria-hidden
              />

              <div
                className={`relative mt-auto ${category.imageUrl ? "text-white" : ""}`}
              >
                <p className="text-sm font-semibold">{category.name}</p>
                {category.description && (
                  <p
                    className={`line-clamp-1 text-xs ${category.imageUrl ? "opacity-80" : "text-muted-foreground"}`}
                  >
                    {category.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
