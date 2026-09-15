"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/modules/cart/hooks/use-cart";
import { useCartDrawer } from "@/modules/cart/store/cart-drawer.store";

export function CartButton() {
  const { data: items } = useCart();

  // Suma de cantidades, no de filas: dos unidades de un producto son 2.
  const count = (items ?? []).reduce((total, item) => total + item.quantity, 0);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={`Abrir carrito${count > 0 ? ` (${count})` : ""}`}
      className="relative rounded-full"
      onClick={() => useCartDrawer.getState().setOpen(true)}
    >
      <ShoppingCart className="size-[18px]" aria-hidden />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground tabular-nums">
          {count}
        </span>
      )}
    </Button>
  );
}
