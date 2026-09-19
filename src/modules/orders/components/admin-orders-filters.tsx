"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import type {
  AdminOrderFilters,
  OrderStatus,
} from "@/modules/orders/types/order";

// `<Select>` no admite un item con valor vacío: "todos" viaja como centinela y
// se traduce a `undefined` antes de salir hacia arriba.
const ALL = "all";

const STATUSES = Object.entries(ORDER_STATUS_LABEL) as [OrderStatus, string][];

// El Select puede emitir `null` al deseleccionar: se normaliza junto con el
// centinela para que el filtro salga como "sin filtro".
function clean(next: string | null): OrderStatus | undefined {
  // Los items del Select son exactamente las claves de ORDER_STATUS_LABEL.
  return !next || next === ALL ? undefined : (next as OrderStatus);
}

type AdminOrdersFiltersProps = {
  value: AdminOrderFilters;
  onChange: (filters: AdminOrderFilters) => void;
};

// Controlada de punta a punta: no guarda estado propio. El retardo del buscador
// lo aplica la tabla sobre el texto antes de consultar (AC4), así tipear no
// dispara una consulta por tecla pero el input responde al instante.
export function AdminOrdersFilters({
  value,
  onChange,
}: AdminOrdersFiltersProps) {
  const hasFilters = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="orders-from">Desde</Label>
        <Input
          id="orders-from"
          type="date"
          className="w-40"
          value={value.from ?? ""}
          onChange={(event) =>
            onChange({ ...value, from: event.target.value || undefined })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="orders-to">Hasta</Label>
        <Input
          id="orders-to"
          type="date"
          className="w-40"
          value={value.to ?? ""}
          onChange={(event) =>
            onChange({ ...value, to: event.target.value || undefined })
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="orders-status">Estado</Label>
        <Select
          value={value.status ?? ALL}
          onValueChange={(next) => onChange({ ...value, status: clean(next) })}
        >
          <SelectTrigger id="orders-status" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {STATUSES.map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="orders-search">Cliente</Label>
        <Input
          id="orders-search"
          type="search"
          className="w-64"
          placeholder="Email, nombre o apellido"
          value={value.search ?? ""}
          onChange={(event) =>
            onChange({ ...value, search: event.target.value || undefined })
          }
        />
      </div>

      <Button
        variant="outline"
        disabled={!hasFilters}
        onClick={() => onChange({})}
      >
        Limpiar
      </Button>
    </div>
  );
}
