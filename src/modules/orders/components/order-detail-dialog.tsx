"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { useReceipt } from "@/modules/orders/hooks/use-orders";
import type { OrderWithItems } from "@/modules/orders/types/order";

type OrderDetailDialogProps = {
  trigger: ReactElement;
  order: OrderWithItems;
};

export function OrderDetailDialog({ trigger, order }: OrderDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const receipt = useReceipt();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* base-ui usa `render`, no `asChild`. */}
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle de la compra</DialogTitle>
          <DialogDescription>
            {new Date(order.createdAt).toLocaleString("es-AR")}
          </DialogDescription>
        </DialogHeader>

        <Badge variant="secondary" className="w-fit">
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>

        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-sm">
              <span className="min-w-0">
                {item.name}
                <span className="text-muted-foreground">
                  {" "}
                  × {item.quantity} · {formatPrice(item.unitPrice)} c/u
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={receipt.isPending}
          >
            Cerrar
          </Button>
          {/* El error lo avisa el `toast` del hook: el Dialog sigue abierto. */}
          <Button
            onClick={() => receipt.mutate(order.id)}
            disabled={receipt.isPending}
          >
            {receipt.isPending ? "Abriendo…" : "Descargar boleta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
