"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage, isConflict } from "@/lib/api-error";
import { useAdjustInventory } from "@/modules/products/hooks/use-inventory";
import {
  adjustInventorySchema,
  type AdjustInventoryInput,
} from "@/modules/products/schemas/inventory.schema";
import type { InventoryRow } from "@/modules/products/types/product";

type AdjustStockDialogProps = {
  trigger: ReactElement;
  row: InventoryRow;
};

// Campo vacío = "no toco esto", no cero: un `0` sería un ajuste inválido y un
// punto de reposición real.
const optionalInteger = (value: string) =>
  value === "" ? undefined : Number(value);

export function AdjustStockDialog({ trigger, row }: AdjustStockDialogProps) {
  const [open, setOpen] = useState(false);
  const adjustInventory = useAdjustInventory();

  const defaults: AdjustInventoryInput = {
    delta: undefined,
    reorderPoint: row.reorderPoint,
  };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: defaults,
  });

  const delta = useWatch({ control, name: "delta" });
  const reorderPoint = useWatch({ control, name: "reorderPoint" });

  const resultingStock = row.stock + (Number.isFinite(delta) ? Number(delta) : 0);
  // Sin cambios no hay nada que mandar: evita un PATCH que el servidor
  // rechazaría con 400 ("Nada para ajustar").
  const hasChanges =
    delta !== undefined || (reorderPoint !== undefined && reorderPoint !== row.reorderPoint);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults);
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await adjustInventory.mutateAsync({ id: row.id, input: values });
      toast.success("Inventario actualizado");
      setOpen(false);
    } catch (error) {
      if (isConflict(error)) {
        setError("delta", { message: getApiErrorMessage(error, "") });
        return;
      }

      toast.error(getApiErrorMessage(error, "No se pudo ajustar el stock"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar «{row.name}»</DialogTitle>
          <DialogDescription>
            Stock actual: {row.stock}. Cargá la entrada en positivo y la merma
            en negativo; el ajuste queda registrado en la bitácora.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inventory-delta">
                Entrada (+) o merma (−)
              </FieldLabel>
              <Input
                id="inventory-delta"
                type="number"
                step="1"
                placeholder="Ej.: 10 o -2"
                {...register("delta", { setValueAs: optionalInteger })}
              />
              <p
                className={
                  resultingStock < 0
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                Stock resultante: {resultingStock}
                {resultingStock < 0 && " — el stock no puede quedar negativo"}
              </p>
              <FieldError errors={[errors.delta]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="inventory-reorder-point">
                Punto de reposición
              </FieldLabel>
              <Input
                id="inventory-reorder-point"
                type="number"
                min={0}
                step="1"
                {...register("reorderPoint", { setValueAs: optionalInteger })}
              />
              <FieldError errors={[errors.reorderPoint]} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={adjustInventory.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={adjustInventory.isPending || !hasChanges}
            >
              {adjustInventory.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
