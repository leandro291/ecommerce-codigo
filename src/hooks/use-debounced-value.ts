"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve `value` recién cuando dejó de cambiar por `delay` ms.
 * Cada cambio cancela el timer anterior, así que tipeo continuo = un solo valor.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
