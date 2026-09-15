"use client";

import { Button } from "@/components/ui/button";
import { useCartDrawer } from "@/modules/cart/store/cart-drawer.store";

// Isla mínima: el carrito es un drawer, no una ruta, así que hace falta `onClick`
// donde el `CartButton` icon-only del header no encaja (texto visible).
export function OpenCartButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      // `w-fit`: en la página de éxito el contenedor es `flex-col` y sin esto el
      // botón se estira a todo el ancho.
      className="w-fit rounded-full"
      onClick={() => useCartDrawer.getState().setOpen(true)}
    >
      Ver carrito
    </Button>
  );
}
