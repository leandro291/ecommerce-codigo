"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useFavorites } from "@/modules/products/store/favorites.store";

type FavoriteButtonProps = {
  productId: string;
  /** Posicionamiento y color desde el contenedor; el botón no lo decide. */
  className?: string;
};

export function FavoriteButton({ productId, className }: FavoriteButtonProps) {
  // `persist` rehidrata desde localStorage antes del primer render del cliente,
  // y el servidor siempre pinta el corazón vacío. El tercer argumento le da a
  // React ese snapshot de servidor, así hidrata sin mismatch y luego corrige.
  const isFavorite = useSyncExternalStore(
    useFavorites.subscribe,
    () => useFavorites.getState().ids.includes(productId),
    () => false,
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      onClick={(event) => {
        // Puede vivir dentro de una card enlazada: el click no debe navegar.
        event.preventDefault();
        event.stopPropagation();
        useFavorites.getState().toggle(productId);
      }}
      className={`rounded-full border bg-card/80 backdrop-blur hover:bg-card ${className ?? ""}`}
    >
      <Heart
        className={`size-[17px] transition-colors ${isFavorite ? "fill-brand text-brand" : ""}`}
        aria-hidden
      />
    </Button>
  );
}
