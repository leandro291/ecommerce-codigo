import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <Link href="/" className="text-lg font-semibold">
        E-commerce Tech
      </Link>

      <nav className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">
              Iniciar sesión
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Registrarse</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </header>
  );
}
