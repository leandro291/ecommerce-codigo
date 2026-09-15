import { Skeleton } from "@/components/ui/skeleton";

// Esqueleto del panel del bento: hero + rail + tiles, con las mismas
// proporciones que `page.tsx` para que no haya salto al hidratar.
export default function StorefrontLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:p-8 lg:pt-6">
      <div className="flex flex-col gap-4 rounded-5xl border bg-panel p-4 shadow-[var(--shadow-lift)] sm:p-5 lg:h-full lg:min-h-0">
        <div className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[1.62fr_1fr] lg:grid-rows-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Skeleton className="h-[420px] rounded-3xl lg:col-start-1 lg:row-start-1 lg:h-full" />
          <Skeleton className="h-[300px] rounded-3xl lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-start-1 lg:row-start-2 lg:min-h-0">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-3xl lg:h-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
