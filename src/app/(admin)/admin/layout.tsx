import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { AdminNav, type AdminNavItem } from "@/components/shared/admin-nav";
import { Toaster } from "@/components/ui/sonner";
import { requirePanelAccess } from "@/lib/auth";
import { can, type PermissionCode } from "@/lib/permissions";

const NAV_ITEMS: readonly (AdminNavItem & { permission: PermissionCode })[] = [
  {
    href: "/admin/categories",
    label: "Categorías",
    permission: "categories.read",
  },
  { href: "/admin/products", label: "Productos", permission: "products.read" },
  { href: "/admin/users", label: "Usuarios", permission: "users.read" },
  { href: "/admin/roles", label: "Puestos", permission: "roles.read" },
  {
    href: "/admin/audit-logs",
    label: "Auditoría",
    permission: "audit_logs.read",
  },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Redirige a /sin-acceso si falta `dashboard.read`. `resolvePermissions` está
  // memoizado por request, así que el guard y el filtrado del nav son una query.
  const { permissions } = await requirePanelAccess();
  const items = NAV_ITEMS.filter((item) => can(permissions, item.permission));

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r px-4 py-6">
        <Link href="/" className="px-2 text-lg font-semibold">
          Administración
        </Link>

        <AdminNav items={items} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b px-6 py-4">
          <UserButton />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
