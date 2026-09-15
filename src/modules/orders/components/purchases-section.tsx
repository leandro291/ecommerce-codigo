"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/money";
import { OrderDetailDialog } from "@/modules/orders/components/order-detail-dialog";
import { useOrders } from "@/modules/orders/hooks/use-orders";
import type { OrderRangeQuery } from "@/modules/orders/schemas/order.schema";
import type { OrderWithItems } from "@/modules/orders/types/order";

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

// `en-CA` da `YYYY-MM-DD` en hora local; `toISOString()` corre el día para
// quien está al oeste de UTC.
function toDateInput(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

// El servidor recibe `YYYY-MM-DD` sin hora: sin el offset del navegador
// interpretaría los bordes del rango en UTC y correría un día las órdenes.
function browserTzOffset(): number {
  return new Date().getTimezoneOffset();
}

function currentMonthRange(): OrderRangeQuery {
  const today = new Date();

  return {
    from: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateInput(today),
    tzOffset: browserTzOffset(),
  };
}

// El encabezado formateado es único por día y las órdenes ya vienen desc: la
// clave del grupo puede ser el propio texto y el orden lo mantiene el Map.
function groupByDay(orders: OrderWithItems[]): [string, OrderWithItems[]][] {
  const groups = new Map<string, OrderWithItems[]>();

  for (const order of orders) {
    // `createdAt` viaja como string por JSON aunque el tipo diga Date.
    const day = dayFormatter.format(new Date(order.createdAt));
    const group = groups.get(day);

    if (group) group.push(order);
    else groups.set(day, [order]);
  }

  return [...groups];
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4" />
          Mis compras
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-(--card-spacing)">
        {children}
      </CardContent>
    </Card>
  );
}

export function PurchasesSection() {
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [custom, setCustom] = useState<OrderRangeQuery>(() => ({
    tzOffset: browserTzOffset(),
  }));

  const monthRange = useMemo(() => currentMonthRange(), []);
  const range = mode === "month" ? monthRange : custom;

  // Comparación lexicográfica de `YYYY-MM-DD`: mismo criterio que el refine de
  // Zod en el servidor.
  const invalidRange = Boolean(range.from && range.to && range.from > range.to);

  // En modo custom no se consulta hasta tener ambos extremos: un rango a medias
  // haría que el repositorio devuelva el historial completo.
  const complete = mode === "month" || Boolean(custom.from && custom.to);

  const { data, isPending, isError, error, refetch } = useOrders(
    range,
    complete && !invalidRange,
  );

  const groups = data ? groupByDay(data) : [];

  return (
    <Shell>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="purchases-mode">Período</Label>
          <Select
            value={mode}
            onValueChange={(next) =>
              setMode(next === "custom" ? "custom" : "month")
            }
          >
            <SelectTrigger id="purchases-mode" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mes actual</SelectItem>
              <SelectItem value="custom">Rango custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "custom" ? (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="purchases-from">Desde</Label>
              <Input
                id="purchases-from"
                type="date"
                className="w-40"
                value={custom.from ?? ""}
                onChange={(event) =>
                  setCustom((prev) => ({
                    ...prev,
                    from: event.target.value || undefined,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="purchases-to">Hasta</Label>
              <Input
                id="purchases-to"
                type="date"
                className="w-40"
                value={custom.to ?? ""}
                onChange={(event) =>
                  setCustom((prev) => ({
                    ...prev,
                    to: event.target.value || undefined,
                  }))
                }
              />
            </div>
          </>
        ) : null}
      </div>

      {invalidRange ? (
        <p className="text-sm text-destructive">
          «Desde» no puede ser posterior a «hasta».
        </p>
      ) : !complete ? (
        <p className="text-sm text-muted-foreground">
          Elegí «desde» y «hasta» para ver tus compras del período.
        </p>
      ) : isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            No se pudieron cargar tus compras: {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No hay compras en este período.
          </p>
          <Button
            render={<Link href="/products" />}
            nativeButton={false}
            size="sm"
            className="rounded-full"
          >
            Ver catálogo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([day, dayOrders]) => (
            <section key={day} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">
                {day}
              </h3>

              <ul className="flex flex-col gap-2">
                {dayOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatPrice(order.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.length}{" "}
                        {order.items.length === 1 ? "producto" : "productos"}
                      </p>
                    </div>

                    <OrderDetailDialog
                      order={order}
                      trigger={
                        <Button variant="outline" size="sm">
                          Ver detalle
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}
