import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { OpenCartButton } from "@/modules/cart/components/open-cart-button";

export const metadata: Metadata = {
  title: "Pago cancelado — E-commerce Tech",
  description: "Cancelaste el pago; tu carrito quedó intacto.",
};

// Solo informa: la order queda `pending` y la limpia el TTL. Nada que escribir.
export default function CheckoutCancelPage() {
  return (
    <main className="mx-auto w-full max-w-[720px] p-4 sm:p-6 lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Cancelaste el pago
        </h1>
        <p className="text-sm text-muted-foreground">
          No se hizo ningún cobro y tu carrito quedó tal como estaba. Podés
          retomar la compra cuando quieras.
        </p>

        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/products" />}
            nativeButton={false}
            size="sm"
            className="rounded-full"
          >
            Ver catálogo
          </Button>
          <OpenCartButton />
        </div>
      </div>
    </main>
  );
}
