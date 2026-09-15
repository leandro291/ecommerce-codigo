import Link from "next/link";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  catalogHref,
  type CatalogQuery,
} from "@/modules/products/lib/catalog-href";

// Mismo lenguaje visual que los chips de `category-filters.tsx`: pastilla
// redonda, activa en `bg-brand`, inactiva en texto atenuado.
const PAGE_LINK =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition duration-150 hover:-translate-y-px";
const PAGE_ACTIVE = "border-transparent bg-brand text-brand-foreground";
const PAGE_IDLE = "bg-transparent text-muted-foreground hover:text-foreground";

type PageSlot = number | "ellipsis";

// Hasta 7 páginas se listan todas; por encima, `1 … actual-1 actual actual+1 … última`,
// para no escupir un renglón de 40 enlaces cuando el catálogo crezca.
export function pageWindow(current: number, total: number): PageSlot[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  const slots: PageSlot[] = [1];

  if (start > 2) slots.push("ellipsis");
  for (let page = start; page <= end; page += 1) slots.push(page);
  if (end < total - 1) slots.push("ellipsis");
  slots.push(total);

  return slots;
}

type CatalogPaginationProps = {
  currentPage: number;
  totalPages: number;
  query: Partial<CatalogQuery>;
};

// Server Component a propósito: la página vive en la URL, así que los controles
// son enlaces y la paginación funciona sin JavaScript y se puede compartir.
export function CatalogPagination({
  currentPage,
  totalPages,
  query,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <Pagination aria-label="Paginación del catálogo">
      <PaginationContent className="flex-wrap gap-1">
        {currentPage > 1 && (
          <PaginationItem>
            <Link
              href={catalogHref(query, currentPage - 1)}
              rel="prev"
              className={`${PAGE_LINK} ${PAGE_IDLE}`}
            >
              Anterior
            </Link>
          </PaginationItem>
        )}

        {pageWindow(currentPage, totalPages).map((slot, index) =>
          slot === "ellipsis" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={slot}>
              <Link
                href={catalogHref(query, slot)}
                aria-label={`Ir a la página ${slot}`}
                aria-current={slot === currentPage ? "page" : undefined}
                className={`${PAGE_LINK} ${
                  slot === currentPage ? PAGE_ACTIVE : PAGE_IDLE
                }`}
              >
                {slot}
              </Link>
            </PaginationItem>
          ),
        )}

        {currentPage < totalPages && (
          <PaginationItem>
            <Link
              href={catalogHref(query, currentPage + 1)}
              rel="next"
              className={`${PAGE_LINK} ${PAGE_IDLE}`}
            >
              Siguiente
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
