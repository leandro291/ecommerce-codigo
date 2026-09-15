"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="rounded-full"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Ambos íconos se renderizan y los alterna CSS: el estado del tema no se
          conoce en el servidor y leerlo en el primer render rompe la hidratación. */}
      <Sun className="size-[17px] dark:hidden" aria-hidden />
      <Moon className="hidden size-[17px] dark:block" aria-hidden />
    </Button>
  );
}
