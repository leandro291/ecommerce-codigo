import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CatalogQuery } from "@/modules/products/lib/catalog-href";
import { SearchAutocomplete } from "@/modules/products/components/search-autocomplete";

type CatalogToolbarProps = {
  query: CatalogQuery;
};

// Server Component: la búsqueda es un form GET, así que no necesita JavaScript.
// Lo de cliente es `<SearchAutocomplete>` (sugerencias en vivo); el submit del
// form sigue siendo nativo. Los filtros de categoría y el orden viven en
// `<CategoryFilters>`, la columna izquierda del catálogo.
export function CatalogToolbar({ query }: CatalogToolbarProps) {
  return (
    <div className="rounded-3xl border bg-card p-3 shadow-[var(--shadow-soft)] sm:p-4">
      {/* GET, no Server Action: el estado del catálogo vive en la URL y así queda
          compartible y cacheable. `category` y `sort` viajan escondidos para que
          buscar no borre los otros filtros. */}
      <form action="/products" className="flex items-center gap-2">
        {query.category && (
          <input type="hidden" name="category" value={query.category} />
        )}
        {query.sort !== "relevance" && (
          <input type="hidden" name="sort" value={query.sort} />
        )}

        <SearchAutocomplete
          defaultValue={query.search ?? ""}
          category={query.category}
        />

        <Button
          type="submit"
          size="icon-lg"
          className="rounded-full"
          aria-label="Buscar"
        >
          <ArrowRight aria-hidden />
        </Button>
      </form>
    </div>
  );
}
