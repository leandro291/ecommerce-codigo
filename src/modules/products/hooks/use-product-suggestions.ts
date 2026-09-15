"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import * as productService from "@/modules/products/services/product.service";

/** Máximo de sugerencias del dropdown (dentro del 1–48 del schema público). */
export const SUGGESTIONS_LIMIT = 5;

/** Con 1 carácter la lista es ruido y la consulta, un `ilike '%a%'` inútil. */
export const MIN_SUGGESTION_LENGTH = 2;

export function useProductSuggestions(term: string, category?: string) {
  return useQuery({
    queryKey: ["products", "suggestions", term, category ?? null],
    // El `signal` va derecho a axios: al cambiar el término, la petición en
    // vuelo se aborta y nunca pinta un resultado viejo.
    queryFn: ({ signal }) =>
      productService.searchPublicProducts({
        search: term,
        category,
        limit: SUGGESTIONS_LIMIT,
        signal,
      }),
    enabled: term.length >= MIN_SUGGESTION_LENGTH,
    staleTime: 60_000,
    // Mantiene la lista anterior mientras llega la nueva: el panel no parpadea.
    placeholderData: keepPreviousData,
  });
}
