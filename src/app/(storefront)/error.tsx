"use client";

import { Button } from "@/components/ui/button";

// `retry` (Next 16) en vez de `reset`: el fallo típico acá es una lectura a BD,
// y hay que re-ejecutarla, no solo re-renderizar el subárbol.
export default function StorefrontError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center gap-3 rounded-5xl border bg-panel px-6 py-20 text-center shadow-[var(--shadow-lift)]">
        <h1 className="font-heading text-xl font-semibold">
          No pudimos cargar el catálogo
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Hubo un problema al traer los productos. Probá de nuevo en unos
          segundos.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">
            Referencia: {error.digest}
          </p>
        )}
        <Button onClick={retry} className="mt-2">
          Reintentar
        </Button>
      </div>
    </main>
  );
}
