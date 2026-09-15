import Link from "next/link";

import type { Category } from "@/modules/categories/types/category";
import {
  catalogHref,
  type CatalogQuery,
} from "@/modules/products/lib/catalog-href";
import { SortSelect } from "@/modules/products/components/sort-select";

const CHIP =
  "rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition duration-150 hover:-translate-y-px lg:w-full lg:text-left";
const CHIP_ACTIVE = "border-transparent bg-brand text-brand-foreground";
const CHIP_IDLE = "bg-transparent text-muted-foreground hover:text-foreground";

type CategoryFiltersProps = {
  categories: Category[];
  query: CatalogQuery;
};

// Server Component: los chips son enlaces, así que filtrar por categoría no
// necesita JavaScript. En mobile/tablet es la fila horizontal de siempre; a
// partir de `lg:` se vuelve la columna izquierda del catálogo (sidebar).
export function CategoryFilters({ categories, query }: CategoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-3 shadow-[var(--shadow-soft)] sm:p-4 lg:sticky lg:top-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 lg:flex-col lg:items-stretch lg:overflow-visible lg:pb-0">
          <Link
            href={catalogHref({ search: query.search, sort: query.sort })}
            aria-current={query.category ? undefined : "page"}
            className={`${CHIP} ${query.category ? CHIP_IDLE : CHIP_ACTIVE}`}
          >
            Todos
          </Link>

          {categories.map((category) => {
            const isActive = category.slug === query.category;

            return (
              <Link
                key={category.id}
                href={catalogHref({ ...query, category: category.slug })}
                aria-current={isActive ? "page" : undefined}
                className={`${CHIP} ${isActive ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {category.name}
              </Link>
            );
          })}
        </div>

        <SortSelect query={query} className="lg:ml-0 lg:w-full" />
      </div>
    </div>
  );
}
