"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { resolveActiveHref } from "@/components/shared/resolve-active-href";
import { cn } from "@/lib/utils";

export type AdminNavItem = { href: string; label: string };

// Solo marca el activo. El filtrado por permisos lo hace el server (layout):
// nunca se recalculan permisos en el cliente.
export function AdminNav({ items }: { items: readonly AdminNavItem[] }) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(
    pathname,
    items.map((item) => item.href),
  );

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {items.map(({ href, label }) => {
        const isActive = href === activeHref;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent font-medium text-accent-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
