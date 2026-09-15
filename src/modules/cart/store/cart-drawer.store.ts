import { create } from "zustand";

// Solo UI: si el drawer está abierto o cerrado. Los ítems son dato de servidor y
// viven en TanStack Query (docs/SETUP.md §4, regla 6). Sin `persist`: que el
// drawer siga abierto tras un refresh no le sirve a nadie.
type CartDrawerState = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
};

export const useCartDrawer = create<CartDrawerState>()((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
}));
