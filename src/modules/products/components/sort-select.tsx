"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  catalogHref,
  type CatalogQuery,
} from "@/modules/products/lib/catalog-href";

const OPTIONS: { value: CatalogQuery["sort"]; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
];

type SortSelectProps = {
  /** Filtros vigentes: el orden cambia, el resto de la URL se conserva. */
  query: CatalogQuery;
  /** El sidebar del catálogo lo quiere a ancho completo en vez de empujado a la derecha. */
  className?: string;
};

// Único `"use client"` del catálogo: cambiar el orden es la sola interacción que
// no puede resolverse con un `<Link>` o un form GET.
export function SortSelect({ query, className }: SortSelectProps) {
  const router = useRouter();

  return (
    <Select
      value={query.sort}
      onValueChange={(next) => {
        if (!next) return;
        // `replace`: el orden no merece una entrada en el historial.
        router.replace(catalogHref({ ...query, sort: next }));
      }}
    >
      <SelectTrigger
        aria-label="Ordenar"
        className={cn("h-9 rounded-full bg-card px-4 text-[13px] sm:ml-auto", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
