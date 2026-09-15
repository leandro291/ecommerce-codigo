"use client";

import { Loader2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  quantity: number;
  /** Piso: en el drawer es 1; en la card es 0 (bajar de 1 quita el ítem). */
  min: number;
  max: number;
  /** Mutación en vuelo: los botones se apagan y el número pasa a spinner. */
  disabled?: boolean;
  onChange: (quantity: number) => void;
  className?: string;
};

/**
 * Presentacional: no conoce el carrito ni dispara mutaciones. Quien lo monta
 * decide qué significa cada valor (0 = quitar, en la card).
 */
export function QuantityStepper({
  quantity,
  min,
  max,
  disabled = false,
  onChange,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 rounded-full border bg-background p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Restar uno"
        disabled={disabled || quantity <= min}
        onClick={() => onChange(quantity - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <span className="min-w-6 text-center text-sm tabular-nums">
        {disabled ? (
          <Loader2 className="mx-auto size-3 animate-spin" aria-hidden />
        ) : (
          quantity
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Sumar uno"
        disabled={disabled || quantity >= max}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
