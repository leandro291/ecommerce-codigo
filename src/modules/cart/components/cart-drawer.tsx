"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatPrice } from "@/lib/money";
import { QuantityStepper } from "@/modules/cart/components/quantity-stepper";
import {
  useCart,
  useRemoveFromCart,
  useSetCartQuantity,
} from "@/modules/cart/hooks/use-cart";
import { MAX_QUANTITY } from "@/modules/cart/schemas/cart.schema";
import { useCartDrawer } from "@/modules/cart/store/cart-drawer.store";
import type { CartItem } from "@/modules/cart/types/cart";
import { useCheckout } from "@/modules/checkout/hooks/use-checkout";

export function CartDrawer() {
  const isOpen = useCartDrawer((state) => state.isOpen);
  const setOpen = useCartDrawer((state) => state.setOpen);
  const { data: items, isPending, isError, error, refetch } = useCart();
  const checkout = useCheckout();

  // Centavos enteros de punta a punta: sumar y recién formatear al pintar.
  const subtotal = (items ?? []).reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tu carrito</SheetTitle>
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto p-4">
          {isError ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/40 p-4">
              <p className="text-sm text-destructive">
                {getApiErrorMessage(error, "No se pudo cargar tu carrito")}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : isPending ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="size-16 shrink-0 rounded-2xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="font-heading text-base font-semibold">
                Tu carrito está vacío
              </p>
              <p className="max-w-[240px] text-sm text-muted-foreground">
                Agregá productos desde el catálogo y aparecen acá.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setOpen(false)}
              >
                Seguir viendo
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <CartRow key={item.productId} item={item} />
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <SheetFooter>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-heading text-lg font-semibold">
              {formatPrice(subtotal)}
            </span>
          </div>
          {/* Sigue deshabilitado mientras redirige: el navegador tarda en irse
              a Stripe y un segundo click crearía otro pedido. */}
          <Button
            className="w-full rounded-full"
            disabled={!items?.length || checkout.isPending}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending ? "Redirigiendo…" : "Iniciar compra"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const setQuantity = useSetCartQuantity();
  const remove = useRemoveFromCart();

  const isBusy = setQuantity.isPending || remove.isPending;
  const rowError = setQuantity.error ?? remove.error;

  return (
    <li className="flex gap-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-card-soft">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="size-5" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold">
          {item.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatPrice(item.price * item.quantity)}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <QuantityStepper
            quantity={item.quantity}
            min={1}
            max={Math.min(item.stock, MAX_QUANTITY)}
            disabled={isBusy}
            onChange={(quantity) =>
              setQuantity.mutate({ productId: item.productId, quantity })
            }
          />

          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            disabled={isBusy}
            onClick={() => remove.mutate(item.productId)}
          >
            Quitar
          </Button>
        </div>

        {rowError && (
          <p className="text-xs text-destructive">
            {getApiErrorMessage(rowError, "No se pudo actualizar el ítem")}
          </p>
        )}
      </div>
    </li>
  );
}
