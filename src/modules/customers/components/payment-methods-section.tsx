"use client";

import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePaymentMethods,
  useRemoveCard,
  useAddCard,
} from "@/modules/customers/hooks/use-payment-methods";
import type { PaymentMethod } from "@/modules/customers/types/payment-method";

// Stripe no expone el PAN: `brand` + `last4` es todo lo que hay para mostrar.
function cardLabel(card: PaymentMethod): string {
  return `${card.brand} •••• ${card.last4}`;
}

function RemoveCardDialog({ card }: { card: PaymentMethod }) {
  const [open, setOpen] = useState(false);
  const removeCard = useRemoveCard();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Eliminar
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar tarjeta</DialogTitle>
          <DialogDescription>
            Se va a desasociar «<span className="capitalize">{cardLabel(card)}</span>
            » de tu cuenta. Vas a poder volver a guardarla cuando quieras.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={removeCard.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            // El error lo avisa el propio hook con un toast: el diálogo queda
            // abierto para reintentar.
            onClick={() =>
              removeCard.mutate(card.id, { onSuccess: () => setOpen(false) })
            }
            disabled={removeCard.isPending}
          >
            {removeCard.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// `justSetup` llega por prop desde la página, que ya lee los `searchParams`: así
// esta sección no necesita `useSearchParams()` ni su frontera de Suspense.
export function PaymentMethodsSection({ justSetup }: { justSetup: boolean }) {
  const { data, isPending, isError, error, refetch } = usePaymentMethods();
  const addCard = useAddCard();

  const empty = data?.length === 0;

  // Carrera webhook/redirect: el usuario vuelve de Stripe antes de que llegue el
  // evento. Un vacío pelado mentiría. El `id` fijo evita el toast duplicado del
  // doble render de StrictMode.
  useEffect(() => {
    if (justSetup && empty) {
      toast.info("Tu tarjeta se está registrando, actualizá en unos segundos", {
        id: "card-registering",
      });
    }
  }, [justSetup, empty]);

  return (
    <Card className="p-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4" />
          Mis tarjetas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-(--card-spacing)">
        <div>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => addCard.mutate()}
            disabled={addCard.isPending}
          >
            {addCard.isPending ? "Redirigiendo…" : "Agregar tarjeta"}
          </Button>
        </div>

        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">
              No se pudieron cargar tus tarjetas: {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no guardaste ninguna tarjeta. Agregá una para pagar más
            rápido.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <p className="text-sm font-medium capitalize">
                  {cardLabel(card)}
                </p>

                <RemoveCardDialog card={card} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
