// Catálogo de permisos del RBAC. Es la fuente de verdad del catálogo: el seed
// llena la tabla `permissions` desde acá y `resource`/`action` se derivan del
// código con `code.split(".")`, para que no puedan divergir.
//
// Ojo con `ROLE_PERMISSIONS` (más abajo): desde el spec 008 es solo la **semilla
// de arranque** de la matriz. La verdad en runtime es la tabla
// `role_permissions`, editable desde `/admin/roles`.
//
// Datos puros, sin imports: lo consumen tanto el servidor (`@/lib/permissions`,
// seed, webhook) como el cliente (schemas Zod, diálogos de puestos). Vive
// separado porque `@/lib/permissions` arrastra `next/server` y `@/server/db`,
// que lanza si falta `DATABASE_URL` al evaluarse.

export const PERMISSIONS = [
  { code: "dashboard.read", description: "Acceder al panel de administración" },

  { code: "products.read", description: "Ver productos" },
  { code: "products.create", description: "Crear productos" },
  { code: "products.update", description: "Editar productos" },
  { code: "products.delete", description: "Eliminar productos" },

  { code: "categories.read", description: "Ver categorías" },
  { code: "categories.create", description: "Crear categorías" },
  { code: "categories.update", description: "Editar categorías" },
  { code: "categories.delete", description: "Eliminar categorías" },

  { code: "orders.read", description: "Ver pedidos" },
  { code: "orders.update_status", description: "Cambiar el estado de un pedido" },
  { code: "orders.delete", description: "Eliminar pedidos" },

  { code: "customers.read", description: "Ver clientes" },

  { code: "users.read", description: "Ver usuarios del panel" },
  { code: "users.create", description: "Crear usuarios del panel" },
  { code: "users.update", description: "Editar usuarios del panel" },
  { code: "users.deactivate", description: "Desactivar usuarios del panel" },
  { code: "users.assign_role", description: "Asignar puestos a un usuario" },
  {
    code: "users.assign_admin",
    description: "Asignar el puesto de administrador",
  },

  { code: "roles.read", description: "Ver puestos y sus permisos" },
  { code: "roles.update", description: "Editar los permisos de un puesto" },

  { code: "audit_logs.read", description: "Ver la bitácora de auditoría" },
] as const satisfies readonly { code: string; description: string }[];

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export const ROLES = [
  {
    slug: "super_admin",
    name: "Dueño",
    description: "Control total del sistema, incluidos puestos y permisos",
  },
  {
    slug: "admin",
    name: "Administrador",
    description: "Gestión completa del panel salvo puestos y administradores",
  },
  {
    slug: "manager",
    name: "Encargado",
    description: "Gestión de catálogo y pedidos",
  },
  {
    slug: "employee",
    name: "Empleado",
    description: "Consulta del catálogo y avance de pedidos",
  },
  {
    slug: "audit",
    name: "Auditoría",
    description: "Solo lectura, incluida la bitácora",
  },
  {
    slug: "customer",
    name: "Cliente",
    description: "Comprador del sitio, sin acceso al panel",
  },
] as const satisfies readonly {
  slug: string;
  name: string;
  description: string;
}[];

export type RoleSlug = (typeof ROLES)[number]["slug"];

// Rol por defecto de todo `clerk_id` sin asignación. Único lugar donde vive el
// default (SETUP.md §5.1 regla 3).
export const DEFAULT_ROLE_SLUG: RoleSlug = "customer";

// Semilla de arranque de la matriz puesto→permiso, no su estado actual: el
// runtime resuelve permisos leyendo `role_permissions` y el Dueño la edita desde
// `/admin/roles` (spec 008). Acá solo la consumen `db:seed`
// (`onConflictDoNothing`: siembra, nunca revoca) y los asserts de
// `rbac.check.ts`. Cambiar esta constante no cambia una base ya sembrada.
//
// `"*"` = todos los permisos del catálogo, presentes y futuros. Solo el dueño.
export const ROLE_PERMISSIONS: Record<
  RoleSlug,
  readonly PermissionCode[] | "*"
> = {
  super_admin: "*",
  admin: [
    "dashboard.read",
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "orders.read",
    "orders.update_status",
    "orders.delete",
    "customers.read",
    "users.read",
    "users.create",
    "users.update",
    "users.deactivate",
    "users.assign_role",
    "roles.read",
    "audit_logs.read",
  ],
  manager: [
    "dashboard.read",
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "categories.read",
    "categories.create",
    "categories.update",
    "categories.delete",
    "orders.read",
    "orders.update_status",
    "customers.read",
  ],
  employee: [
    "dashboard.read",
    "products.read",
    "categories.read",
    "orders.read",
    "orders.update_status",
    "customers.read",
  ],
  audit: [
    "dashboard.read",
    "products.read",
    "categories.read",
    "orders.read",
    "customers.read",
    "users.read",
    "roles.read",
    "audit_logs.read",
  ],
  customer: [],
};

// Asignar estos dos puestos es una escalada de privilegios: exigen el permiso
// extra `users.assign_admin`. Lo consumen los handlers y los diálogos.
// `readonly string[]` y no `RoleSlug[]`: se usa para test de pertenencia contra
// slugs que llegan como string desde la BD. El `satisfies` cuida los typos.
export const ADMIN_ROLE_SLUGS: readonly string[] = [
  "super_admin",
  "admin",
] satisfies RoleSlug[];

// Puestos que se ofrecen en el panel: `customer` es del storefront y lo asigna
// el webhook, nunca una persona.
export function assignableRoles(
  canAssignAdmin: boolean,
): readonly (typeof ROLES)[number][] {
  return ROLES.filter(
    (role) =>
      role.slug !== DEFAULT_ROLE_SLUG &&
      (canAssignAdmin || !ADMIN_ROLE_SLUGS.includes(role.slug)),
  );
}

export function permissionCodesForRole(
  slug: RoleSlug,
): readonly PermissionCode[] {
  const codes = ROLE_PERMISSIONS[slug];

  return codes === "*" ? PERMISSIONS.map((p) => p.code) : codes;
}

// Vive acá (dato puro) y no en `permissions.ts` (Clerk + repositorios) por la
// misma razón que el resto del archivo: se re-exporta desde ahí sin cambiar
// a los llamadores.
export function can(
  permissions: Set<PermissionCode>,
  code: PermissionCode,
): boolean {
  return permissions.has(code);
}
