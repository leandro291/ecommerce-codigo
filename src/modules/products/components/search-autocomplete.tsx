"use client";

import { ImageOff, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatPrice } from "@/lib/money";
import {
  MIN_SUGGESTION_LENGTH,
  useProductSuggestions,
} from "@/modules/products/hooks/use-product-suggestions";

const DEBOUNCE_MS = 250;

/** Ninguna opción marcada: Enter cae al submit nativo del form (011 AC3). */
const NO_ACTIVE = -1;

type SearchAutocompleteProps = {
  /** Texto que ya venía en `?search=`. */
  defaultValue: string;
  /** Categoría activa: las sugerencias respetan el filtro de la URL. */
  category?: string;
};

// Combobox a mano sobre el `<Input>` ya instalado, no `cmdk`: su input
// controlado se queda con Enter, que acá tiene que seguir enviando el form GET.
export function SearchAutocomplete({
  defaultValue,
  category,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE);

  const term = useDebouncedValue(value.trim(), DEBOUNCE_MS);
  const { data, isPending, isError } = useProductSuggestions(term, category);

  const suggestions = data ?? [];
  const isEnabled = term.length >= MIN_SUGGESTION_LENGTH;
  const isPanelOpen = isOpen && isEnabled;
  const activeSuggestion = suggestions[activeIndex];

  function close() {
    setIsOpen(false);
    setActiveIndex(NO_ACTIVE);
  }

  function goTo(slug: string) {
    close();
    router.push(`/products/${slug}`);
  }

  function move(offset: number) {
    if (suggestions.length === 0) return;

    setIsOpen(true);
    setActiveIndex((current) => {
      const next = current + offset;
      if (next < 0) return suggestions.length - 1;
      if (next >= suggestions.length) return 0;
      return next;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }

    if (event.key === "Escape") {
      if (!isPanelOpen) return;
      // Sin `preventDefault` el navegador vacía el `type="search"`.
      event.preventDefault();
      close();
      return;
    }

    // Solo con una opción marcada se intercepta Enter; si no, el form GET
    // sigue su curso y la URL pasa a `?search=…` con `category` y `sort`.
    if (event.key === "Enter" && isPanelOpen && activeSuggestion) {
      event.preventDefault();
      goTo(activeSuggestion.slug);
    }
  }

  const status = !isEnabled
    ? null
    : isPending
      ? "Buscando…"
      : isError
        ? "No se pudieron cargar las sugerencias."
        : suggestions.length === 0
          ? "Sin coincidencias"
          : null;

  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        name="search"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setIsOpen(true);
          setActiveIndex(NO_ACTIVE);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={close}
        onKeyDown={handleKeyDown}
        placeholder="Buscar productos…"
        aria-label="Buscar productos"
        maxLength={80}
        autoComplete="off"
        role="combobox"
        aria-expanded={isPanelOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeSuggestion ? optionId(activeIndex) : undefined
        }
        className="h-11 rounded-full pl-10"
      />

      {isPanelOpen && (
        <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 overflow-hidden rounded-3xl border bg-card p-1.5 shadow-[var(--shadow-lift)]">
          <div aria-live="polite">
            {status && (
              <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                {status}
              </p>
            )}
          </div>

          <div id={listboxId} role="listbox" aria-label="Sugerencias">
            {suggestions.map((product, index) => (
              <div
                key={product.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // `onMouseDown`, no `onClick`: el blur del input dispara antes
                // que el click y se comería la navegación.
                onMouseDown={(event) => {
                  event.preventDefault();
                  goTo(product.slug);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 ${
                  index === activeIndex ? "bg-panel" : ""
                }`}
              >
                {/* Lado fijo para que las 5 filas midan igual y la lista no
                    salte mientras llegan los datos. */}
                <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-card-soft text-muted-foreground">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <ImageOff className="size-4" aria-hidden />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {product.name}
                  </span>
                  {product.description && (
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {product.description}
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-sm font-semibold">
                  {formatPrice(product.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
