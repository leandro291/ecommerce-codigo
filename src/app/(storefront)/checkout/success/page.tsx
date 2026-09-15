import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { OpenCartButton } from "@/modules/cart/components/open-cart-button";
import type { OrderStatus } from "@/server/db/schema";
import * as orderRepository from "@/server/repositories/order.repository";

export const metadata: Metadata = {
  title: "Pago recibido — E-commerce Tech",
  description: "Resumen de tu pedido.",
};

// El pago lo confirma el webhook (spec 018), no esta página: mientras la order
// siga `pending` el copy dice que se está confirmando, no que está listo.
const STATUS_COPY: Record<
  OrderStatus,
  { icon: ReactNode; title: string; message: string }
> = {
  pending: {
    icon: <Clock className="size-6 text-muted-foreground" aria-hidden />,
    title: "Estamos confirmando tu pago",
    message:
      "Puede tardar unos segundos. Te avisamos apenas se acredite; no hace falta que pagues de nuevo.",
  },
  paid: {
    icon: <CheckCircle2 className="size-6 text-brand" aria-hidden />,
    title: "¡Pago confirmado!",
    message: "Estamos preparando tu pedido.",
  },
  fulfilled: {
    icon: <CheckCircle2 className="size-6 text-brand" aria-hidden />,
    title: "¡Pago confirmado!",
    message: "Tu pedido ya está en preparación.",
  },
  failed: {
    icon: <XCircle className="size-6 text-destructive" aria-hidden />,
    title: "El pago no se pudo completar",
    message:
      "No se hizo ningún cobro. Podés intentarlo de nuevo desde tu carrito.",
  },
  expired: {
    icon: <XCircle className="size-6 text-destructive" aria-hidden />,
    title: "La sesión de pago venció",
    message: "No se hizo ningún cobro. Volvé al carrito para empezar de nuevo.",
  },
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[720px] p-4 sm:p-6 lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5">
        {children}
      </div>
    </main>
  );
}

// Server Component: solo lee. El fulfillment (stock, carrito, `paid`) vive en el
// webhook — el usuario puede cerrar la pestaña antes de que cargue esta página.
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const { session_id: sessionId } = await searchParams;

  const [current, order] = await Promise.all([
    getCurrentUser(),
    typeof sessionId === "string"
      ? orderRepository.getBySessionId(sessionId)
      : null,
  ]);

  // Mismo mensaje para "no existe" y "es de otro": un pedido ajeno no se
  // distingue de uno inexistente.
  if (!order || !current?.user || order.userId !== current.user.id) {
    return (
      <Shell>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          No encontramos ese pedido
        </h1>
        <p className="text-sm text-muted-foreground">
          El enlace puede haber vencido o pertenecer a otra cuenta.
        </p>
        <Button
          render={<Link href="/products" />}
          nativeButton={false}
          size="sm"
          className="w-fit rounded-full"
        >
          Ver catálogo
        </Button>
      </Shell>
    );
  }

  const copy = STATUS_COPY[order.status];

  return (
    <Shell>
      <div className="flex items-start gap-3">
        {copy.icon}
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.message}</p>
        </div>
      </div>

      <Card className="p-1">
        <CardContent className="flex flex-col gap-3 px-(--card-spacing) py-4">
          <ul className="flex flex-col gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0">
                  {item.name}
                  <span className="text-muted-foreground">
                    {" "}
                    × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-heading text-lg font-semibold">
              {formatPrice(order.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {order.status === "failed" || order.status === "expired" ? (
        // Sin cobro: lo que corresponde es volver al carrito y reintentar.
        <OpenCartButton />
      ) : (
        <Button
          render={<Link href="/products" />}
          nativeButton={false}
          size="sm"
          className="w-fit rounded-full"
        >
          Seguir comprando
        </Button>
      )}
    </Shell>
  );
}
