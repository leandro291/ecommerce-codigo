import { create } from "zustand";
import { persist } from "zustand/middleware";

type FavoritesState = {
  /** IDs de producto marcados. Array y no Set: `persist` serializa con JSON. */
  ids: string[];
  toggle: (productId: string) => void;
};

// Solo navegador: los favoritos no viajan al backend ni entre dispositivos.
export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (productId) =>
        set((state) => ({
          ids: state.ids.includes(productId)
            ? state.ids.filter((id) => id !== productId)
            : [...state.ids, productId],
        })),
    }),
    { name: "tech-favorites" },
  ),
);
