"use client";

import { SignInButton, Show } from "@clerk/nextjs";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { QuantityStepper } from "@/modules/cart/components/quantity-stepper";
import {
  useAddToCart,
  useCart,
  useRemoveFromCart,
  useSetCartQuantity,
} from "@/modules/cart/hooks/use-cart";
import { MAX_QUANTITY } from "@/modules/cart/schemas/cart.schema";
import { useCartDrawer } from "@/modules/cart/store/cart-drawer.store";

type AddToCartButtonProps = {
  productId: string;
  stock: number;
  /** `sm` en las cards; `lg` a ancho completo en la ficha de producto. */
  size?: "sm" | "lg";
  /** Posicionamiento desde el contenedor; el botón no lo decide. */
  className?: string;
};

export function AddToCartButton({
  productId,
  stock,
  size = "sm",
  className,
}: AddToCartButtonProps) {
  const classes = `rounded-full ${className ?? ""}`;

  if (stock <= 0) {
    return (
      <Button type="button" size={size} disabled className={classes}>
        Sin stock
      </Button>
    );
  }

  return (
    <>
      {/* Sin sesión no hay carrito que tocar: el modal de Clerk primero, así el
          botón nunca dispara una llamada que va a volver 401. */}
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button type="button" size={size} className={classes}>
            <ShoppingCart className="size-4" aria-hidden />
            Agregar
          </Button>
        </SignInButton>
      </Show>

      {/* La rama logueada es otro componente porque los hooks corren aunque
          `Show` no pinte: con `useCart()` acá arriba, cada card de un anónimo
          dispararía un GET /api/cart que vuelve 401. */}
      <Show when="signed-in">
        <CartQuantityControl
          productId={productId}
          size={size}
          className={classes}
        />
      </Show>
    </>
  );
}

function CartQuantityControl({
  productId,
  size,
  className,
}: {
  productId: string;
  size: "sm" | "lg";
  className: string;
}) {
  // Fuente única de la cantidad: la query `["cart"]`. Sin `useState` local, así
  // el mismo producto en dos lugares de la pantalla muestra el mismo número.
  const { data: items } = useCart();
  const add = useAddToCart();
  const setQuantity = useSetCartQuantity();
  const remove = useRemoveFromCart();

  const item = items?.find((cartItem) => cartItem.productId === productId);

  // El botón está posicionado sobre la card: un mensaje inline desplazaría el
  // layout, por eso el error va por toast.
  const notifyError = (fallback: string) => (error: unknown) =>
    toast.error(getApiErrorMessage(error, fallback));

  // Mientras el carrito carga se muestra "Agregar" habilitado: el POST suma, no
  // pisa, así que un click temprano no rompe la cantidad real.
  if (!item) {
    return (
      <Button
        type="button"
        size={size}
        disabled={add.isPending}
        className={className}
        onClick={() =>
          add.mutate(productId, {
            // El drawer se abre solo en el primer agregado; los +/– posteriores
            // no lo tocan para no tapar el catálogo.
            onSuccess: () => useCartDrawer.getState().setOpen(true),
            onError: notifyError("No se pudo agregar el producto"),
          })
        }
      >
        {add.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ShoppingCart className="size-4" aria-hidden />
        )}
        Agregar
      </Button>
    );
  }

  return (
    <QuantityStepper
      quantity={item.quantity}
      min={0}
      max={Math.min(item.stock, MAX_QUANTITY)}
      disabled={setQuantity.isPending || remove.isPending}
      className={className}
      onChange={(quantity) =>
        quantity === 0
          ? remove.mutate(productId, {
              onError: notifyError("No se pudo quitar el producto"),
            })
          : setQuantity.mutate(
              { productId, quantity },
              { onError: notifyError("No se pudo actualizar la cantidad") },
            )
      }
    />
  );
}
