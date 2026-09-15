"use client";

import { UserButton } from "@clerk/nextjs";
import { User } from "lucide-react";

/**
 * Clerk valida los children del `UserButton` por identidad de referencia, y esa
 * comparación falla si los elementos se crean en un Server Component: cruzan el
 * borde RSC como client references. Por eso el menú vive acá y no en el Header.
 */
export function UserMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          href="/profile"
          label="Mi perfil"
          labelIcon={<User className="size-4" />}
        />
        {/* Sin declarar `manageAccount`, Clerk fuerza esa opción al primer
            puesto y "Mi perfil" queda segundo. Declararla respeta el orden. */}
        <UserButton.Action label="manageAccount" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
