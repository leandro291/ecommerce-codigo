import { Show } from "@clerk/nextjs";

import { Header } from "@/components/shared/header";
import { Toaster } from "@/components/ui/sonner";
import { CartDrawer } from "@/modules/cart/components/cart-drawer";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    // El gradiente cubre header y contenido, por eso vive acá y no en la página.
    // En desktop el bento de la landing es de una pantalla: se ancla a `dvh`. El
    // `overflow-y-auto` es para las rutas que sí crecen (catálogo, ficha); la
    // landing entra justa y no muestra scroll. En mobile scrollea la página.
    <div className="flex flex-1 flex-col bg-[image:var(--page-gradient)] lg:h-dvh lg:overflow-y-auto">
      <Header />
      {children}

      {/* Una sola instancia para todo el storefront: lo abre el store, no un
          trigger. Solo con sesión, para no montar la query de un anónimo. */}
      <Show when="signed-in">
        <CartDrawer />
      </Show>

      <Toaster />
    </div>
  );
}
