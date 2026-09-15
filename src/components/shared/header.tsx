import { SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import { CartButton } from "@/modules/cart/components/cart-button";

export function Header() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
      <header className="flex items-center gap-4 rounded-[20px] border bg-card px-3 py-2 shadow-[var(--shadow-soft)]">
        <Link
          href="/"
          className="px-1.5 font-heading text-lg font-bold tracking-tighter"
        >
          TECH<span className="text-brand">.</span>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="rounded-full">
                Iniciar sesión
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" className="rounded-full">
                Registrarse
              </Button>
            </SignUpButton>
          </Show>
          {/* El `Show` va acá y no adentro del botón: así un anónimo ni siquiera
              recibe la isla, y `GET /api/cart` no se dispara sin sesión. */}
          <Show when="signed-in">
            <CartButton />
            <UserMenu />
          </Show>
        </nav>
      </header>
    </div>
  );
}
