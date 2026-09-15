---
id: 004
title: RBAC — Cimientos (esquema, seed y helpers de servidor)
status: in-review
module: auth
scope: admin
created: 2026-08-31
---

# 004 — RBAC — Cimientos (esquema, seed y helpers de servidor)

## 1. Contexto

Hoy el proyecto solo tiene **autenticación**: `src/proxy.ts` exige sesión para
`/admin` y `/api/admin`, y los 10 handlers de admin repiten `const { userId } =
await auth()` (verificado en `src/app/api/admin/products/route.ts:14`). **No hay
autorización**: cualquier persona registrada opera el CRUD completo. Es la deuda
declarada en §11 de los specs 002 y 003.

`src/server/db/schema/index.ts` reexporta solo `category` y `product`;
`drizzle/meta/_journal.json` registra dos migraciones (`0000`, `0001`). No existen
`users`, `roles`, `permissions`, `role_permissions`, `user_roles` ni `audit_logs`,
ni `src/lib/{auth,permissions,audit}.ts` (verificado: `src/lib/` tiene
`api-error, axios, db-errors, money(.check), query-client, slug(.check), utils`).

Esta es la **Fase 1** de la hoja de ruta RBAC aprobada (4 fases). Deja el esquema,
el seed y los helpers de servidor listos. **Nada los consume todavía**: ni UI, ni
enforcement, ni webhook. Eso es fases 2–4.

Bloquea a las fases 2, 3 y 4. No depende de nada.

## 2. Objetivo

Tras `npm run db:migrate && npm run db:seed`, Neon tiene las 6 tablas de RBAC con
los 22 permisos del catálogo, los 6 roles de sistema y las 68 filas de la matriz
rol→permiso; `db.transaction()` funciona; y un desarrollador puede resolver los
permisos efectivos de un `clerk_id` con una función de servidor.

## 3. Alcance

### Incluye

- 6 tablas nuevas en `src/server/db/schema/` (una por archivo) + barrel.
- Migración `drizzle/0002_*.sql` generada y aplicada a Neon.
- Cambio de driver: `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless`
  (`Pool`), para habilitar `db.transaction()`.
- 3 repositorios de lectura RBAC + `assignRole` / `revokeRole`.
- `src/lib/permissions.ts` — catálogo tipado, matriz, `resolvePermissions`, `can`,
  `requirePermission`.
- `src/lib/auth.ts` — `getCurrentUser`, `requireAuth`, `requirePanelAccess`.
- `src/lib/audit.ts` — `logAudit(tx, entry)` append-only.
- Seed idempotente de permisos, roles y matriz + promoción del super admin.
- `SUPER_ADMIN_CLERK_ID` / `SUPER_ADMIN_EMAIL` en `.env.example`.

### No incluye (explícito — va en fases 2–4)

- Webhook `/api/webhooks/clerk` y sincronización de `users` desde Clerk (fase 2).
  En esta fase la tabla `users` queda **vacía** salvo la fila del super admin.
- Cambios en `src/proxy.ts` (fase 3).
- Cablear `requirePermission()` en los 10 handlers existentes (fase 3). Siguen con
  el check de sesión actual.
- La página `/sin-acceso` a la que redirige `requirePanelAccess()` (fase 3).
- Cualquier UI: `/admin/users`, selector de puestos, nav filtrada (fase 4).
- Endpoints `/api/admin/users/**` (fase 4).
- Auditar las mutaciones de `product.*` / `category.*` (otro plan).
- Editor visual de la matriz rol×permiso. Los permisos de cada rol se fijan en el
  seed y se cambian por código (decisión 1 del plan).
- Escribir `publicMetadata` en Clerk (fases 2 y 4).

## 4. Criterios de aceptación

- [x] AC1 — Dado `npm run db:generate && npm run db:migrate`, entonces se crea
      `drizzle/0002_*.sql` y `db:studio` muestra en Neon las 6 tablas nuevas con el
      enum `audit_severity` y los 4 índices de `audit_logs`.
- [x] AC2 — Dado `npm run db:seed` en base limpia, entonces inserta 22 permisos,
      6 roles con `is_system = true` y 68 filas en `role_permissions`.
- [x] AC3 — Dado un segundo `npm run db:seed` seguido, entonces no falla y reporta
      0 nuevos en las tres tablas (idempotente vía `onConflictDoNothing`).
- [x] AC4 — Dado el seed, entonces `super_admin` tiene los 22 permisos, `admin` 20
      (sin `users.assign_admin` ni `roles.update`), `manager` 12, `employee` 6,
      `audit` 8 y `customer` 0.
- [x] AC5 — Dado `SUPER_ADMIN_CLERK_ID` + `SUPER_ADMIN_EMAIL` en `.env.local`,
      cuando corre el seed, entonces existe la fila en `users` y su asignación a
      `super_admin` en `user_roles`; una segunda corrida no duplica nada.
- [x] AC6 — Dado el seed sin ninguna de las dos envs, entonces no falla: registra
      "sin super admin configurado" y termina en 0.
- [x] AC7 — Dado `resolvePermissions(clerkId)` de un usuario con rol `manager`,
      entonces devuelve un `Set` con sus 12 códigos.
- [x] AC8 — Dado `resolvePermissions(clerkId)` de un `clerk_id` sin fila en `users`
      o sin fila en `user_roles`, entonces devuelve los permisos del rol `customer`
      (hoy, un `Set` vacío) y **no** lanza. El default `customer` vive solo ahí.
- [x] AC9 — Dado `requirePermission('products.create')` sin sesión de Clerk,
      entonces devuelve `{ ok: false }` con una `NextResponse` `401`; con sesión
      pero sin el permiso, `403`; con el permiso, `{ ok: true }` con el `Set`.
- [ ] AC10 — Dado el cambio de driver, entonces `/admin/categories` y
      `/admin/products` siguen listando, creando, editando y borrando sin cambios
      de código en sus repositorios, y el `409` por slug duplicado sigue saliendo
      (`isUniqueViolation` sigue leyendo el `code` de Postgres con el nuevo driver).
      *Parcial*: los cuatro repositorios y el `409` quedaron verificados contra Neon
      con el driver nuevo, y `build` pasa. Falta el recorrido por la UI con sesión
      de Clerk — es lo que cierra T22.
- [x] AC11 — Dado `db.transaction(async (tx) => { ... })` con `logAudit(tx, ...)`
      dentro, cuando el callback lanza, entonces no queda fila en `audit_logs`.
- [x] AC12 — Dado `logAudit` con `changes.after.password`, entonces la fila
      guardada tiene ese campo como `"[REDACTED]"`.
- [x] AC13 — `npm run check:rbac` en verde y
      `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

**Requiere migración** (`npm run db:generate` + `npm run db:migrate`). Siguiente
correlativo: `0002` (`_journal.json` tiene `0000_dapper_boomer` y
`0001_mighty_dark_beast`). Todo es aditivo: ninguna tabla existente se toca.

Todas las tablas usan el patrón ya establecido en `category.ts`/`product.ts`:
`uuid("id").primaryKey().default(sql\`gen_random_uuid()\`)`, `timestamptz` con
`defaultNow()` y `$onUpdate` en `updated_at`, y tipos con
`InferSelectModel`/`InferInsertModel`.

### `users` — `src/server/db/schema/user.ts`

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `clerk_id` | text | NOT NULL, UNIQUE (`users_clerk_id_unique`) |
| `email` | text | NOT NULL, UNIQUE (`users_email_unique`) |
| `first_name` | text | NULL |
| `last_name` | text | NULL |
| `image_url` | text | NULL |
| `is_active` | boolean | NOT NULL, default `true` |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default `now()` |

### `roles` — `src/server/db/schema/role.ts`

`id` uuid PK · `slug` text NOT NULL UNIQUE · `name` text NOT NULL (etiqueta de UI
en español) · `description` text NULL · `is_system` boolean NOT NULL default
`false` · `created_at` / `updated_at`.

### `permissions` — `src/server/db/schema/permission.ts`

`id` uuid PK · `code` text NOT NULL UNIQUE · `resource` text NOT NULL · `action`
text NOT NULL · `description` text NULL · `created_at`. Tabla **semilla**: no se
edita desde el panel (SETUP.md §5.1 regla 4).

### `role_permissions` — `src/server/db/schema/role-permission.ts`

`role_id` uuid → `roles.id` `ON DELETE CASCADE` · `permission_id` uuid →
`permissions.id` `ON DELETE CASCADE`. PK compuesta con `primaryKey({ columns:
[t.roleId, t.permissionId] })`.

### `user_roles` — `src/server/db/schema/user-role.ts`

`user_id` uuid → `users.id` `ON DELETE CASCADE` · `role_id` uuid → `roles.id`
`ON DELETE RESTRICT` · `assigned_by` uuid → `users.id` NULL `ON DELETE SET NULL` ·
`assigned_at` timestamptz NOT NULL default `now()`. PK compuesta `(user_id,
role_id)`. Índice `user_roles_user_id_idx`.

`RESTRICT` en `role_id` es deliberado: impide borrar un rol que alguien está
usando. Los 6 roles son de sistema y no se borran, pero la garantía queda en la BD.

### `audit_logs` — `src/server/db/schema/audit-log.ts`

Según SETUP.md §5.2, columnas exactas:

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `actor_id` | uuid | NULL, → `users.id` `ON DELETE SET NULL` |
| `action` | text | NOT NULL |
| `entity_type` | text | NOT NULL |
| `entity_id` | text | NULL |
| `changes` | jsonb | NULL |
| `metadata` | jsonb | NULL |
| `ip_address` | inet | NULL |
| `user_agent` | text | NULL |
| `severity` | enum `audit_severity` | NOT NULL, default `'info'` |
| `created_at` | timestamptz | NOT NULL, default `now()` |

```ts
export const auditSeverity = pgEnum("audit_severity", ["info", "warning", "error"]);
```

`actor_id` es `SET NULL` (no `CASCADE`): borrar un usuario nunca borra su traza.

Índices (4, SETUP.md §5.2):
`audit_logs_entity_idx` `(entity_type, entity_id)` ·
`audit_logs_actor_created_at_idx` `(actor_id, created_at desc)` ·
`audit_logs_action_idx` `(action)` ·
`audit_logs_created_at_idx` `(created_at desc)`.

`inet`, `jsonb`, `pgEnum` y `primaryKey` verificados en
`node_modules/drizzle-orm/pg-core/` (0.45.2). El `desc()` de los índices se escribe
`.on(t.createdAt.desc())`.

## 6. Contratos de API

**Ninguno.** Esta fase no crea ni modifica Route Handlers. El contrato que produce
es de **funciones de servidor**:

| Función | Archivo | Firma | Uso previsto |
|---|---|---|---|
| `PERMISSIONS` | `lib/permissions.ts` | `readonly { code, description }[]` | catálogo, fuente del seed |
| `PermissionCode` | `lib/permissions.ts` | unión literal de los 22 códigos | tipado de todo el RBAC |
| `ROLE_PERMISSIONS` | `lib/permissions.ts` | `Record<RoleSlug, readonly PermissionCode[] \| "*">` | matriz del seed |
| `resolvePermissions` | `lib/permissions.ts` | `(clerkId: string) => Promise<Set<PermissionCode>>` | fases 3 y 4 |
| `can` | `lib/permissions.ts` | `(perms: Set<PermissionCode>, code: PermissionCode) => boolean` | nav filtrada, UI |
| `requirePermission` | `lib/permissions.ts` | `(code: PermissionCode) => Promise<Guard>` | handlers de admin |
| `getCurrentUser` | `lib/auth.ts` | `() => Promise<CurrentUser \| null>` | Server Components |
| `requireAuth` | `lib/auth.ts` | `() => Promise<CurrentUser>` (redirige a `/sign-in`) | Server Components |
| `requirePanelAccess` | `lib/auth.ts` | `() => Promise<CurrentUser>` (redirige si no hay `dashboard.read`) | layout admin (fase 3) |
| `logAudit` | `lib/audit.ts` | `(tx: Tx, entry: AuditEntry) => Promise<void>` | dentro de `db.transaction()` |

```ts
// Guard — unión discriminada, sin excepciones de control de flujo.
export type Guard =
  | { ok: true; clerkId: string; user: User | null; permissions: Set<PermissionCode> }
  | { ok: false; response: NextResponse };

// Uso en fase 3, dos líneas por handler:
const guard = await requirePermission("products.create");
if (!guard.ok) return guard.response;
```

`user` puede ser `null`: hasta la fase 2 el `clerk_id` de la sesión puede no tener
fila en `users`. `401` = sin sesión, `403` = sin permiso, ambos con el cuerpo
uniforme `{ error: string }` ya usado por los handlers actuales.

```ts
export type AuditEntry = {
  actorId: string | null;          // users.id, null = sistema/webhook/cron
  action: string;                  // "user.created", "role.assigned"
  entityType: string;              // "user", "role"
  entityId?: string | null;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: "info" | "warning" | "error";
};
```

Sin schema Zod en esta fase: no hay entrada de red que validar. Los schemas
llegan con los endpoints de la fase 4.

### Catálogo de permisos (22)

`dashboard.read` · `products.read|create|update|delete` ·
`categories.read|create|update|delete` · `orders.read|update_status|delete` ·
`customers.read` · `users.read|create|update|deactivate` · `users.assign_role` ·
`users.assign_admin` · `roles.read|update` · `audit_logs.read`.

`resource` y `action` de la tabla se **derivan** en el seed con
`code.split(".")`; no se escriben dos veces.

### Roles (6, todos `is_system = true`)

| slug | name (UI) | permisos |
|---|---|:--:|
| `super_admin` | Dueño | 22 (`"*"`) |
| `admin` | Administrador | 20 |
| `manager` | Encargado | 12 |
| `employee` | Empleado | 6 |
| `audit` | Auditoría | 8 |
| `customer` | Cliente | 0 |

Matriz exacta: la del plan (`~/.claude/plans/vamos-a-iniciar-la-validated-feigenbaum.md`,
sección "Matriz rol → permisos"). "Acceso al panel" = tener `dashboard.read`;
`customer` no lo tiene.

## 7. Arquitectura y archivos afectados

| Capa | Archivo | Estado | Qué hace |
|---|---|---|---|
| Schema | `src/server/db/schema/user.ts` | nuevo | tabla `users` + tipos |
| Schema | `src/server/db/schema/role.ts` | nuevo | tabla `roles` + tipos |
| Schema | `src/server/db/schema/permission.ts` | nuevo | tabla `permissions` + tipos |
| Schema | `src/server/db/schema/role-permission.ts` | nuevo | pivote, PK compuesta |
| Schema | `src/server/db/schema/user-role.ts` | nuevo | pivote, PK compuesta |
| Schema | `src/server/db/schema/audit-log.ts` | nuevo | `audit_logs` + enum `audit_severity` |
| Schema | `src/server/db/schema/index.ts` | modificado | 6 reexports nuevos |
| DB client | `src/server/db/index.ts` | modificado | `Pool` + `neon-serverless`, `export type Tx` |
| Migración | `drizzle/0002_*.sql` | generado | `npm run db:generate` |
| Repo | `src/server/repositories/user.repository.ts` | nuevo | `findByClerkId`, `findById`, `assignRole`, `revokeRole` |
| Repo | `src/server/repositories/role.repository.ts` | nuevo | `list`, `findBySlug` |
| Repo | `src/server/repositories/permission.repository.ts` | nuevo | `list`, `listCodesByClerkId`, `listCodesByRoleSlug` |
| Lib | `src/lib/permissions.ts` | nuevo | catálogo, matriz, resolución, guards |
| Lib | `src/lib/auth.ts` | nuevo | helpers de sesión + acceso al panel |
| Lib | `src/lib/audit.ts` | nuevo | `logAudit` + `stripSensitive` |
| Check | `src/lib/rbac.check.ts` | nuevo | self-check de matriz y redacción |
| Seed | `src/server/db/seed.ts` | modificado | permisos + roles + matriz + super admin |
| Config | `package.json` | modificado | script `check:rbac` |
| Config | `.env.example` | modificado | `SUPER_ADMIN_CLERK_ID`, `SUPER_ADMIN_EMAIL` |

Sin componentes shadcn: esta fase no toca UI.

### Reutilizar (verificado con Read/Grep — usar tal cual, no reescribir)

- `src/server/repositories/category.repository.ts` — **patrón de repositorio**:
  funciones sueltas exportadas (no clase), `import { db } from "@/server/db"`,
  tipos importados del barrel de schema, `const [row] = await ...returning()`.
  Los tres repositorios nuevos lo copian.
- `src/server/db/schema/product.ts` — **patrón de tabla**: `gen_random_uuid()` vía
  `sql`, el array de índices como segundo argumento de `pgTable`,
  `references(() => x.id, { onDelete: ... })`, `InferSelectModel` /
  `InferInsertModel` al pie del archivo.
- `src/lib/db-errors.ts` — `isUniqueViolation`, `isForeignKeyViolation`,
  `violatedConstraint`. **No se duplica el manejo de errores de Postgres**; si el
  driver nuevo cambia la forma del error, se arregla dentro de `pgErrorCode`.
- `src/server/db/seed.ts` — el seed actual **se extiende, no se reescribe**: ya
  carga `.env.local` con `dotenv` antes de importar `db` (el import es dinámico a
  propósito: `db` lee `DATABASE_URL` al evaluarse), ya usa
  `onConflictDoNothing({ target }) + .returning()` para reportar cuántas filas son
  nuevas, y ya resuelve ids por slug con un `Map`. El bloque RBAC repite ese
  esquema.
- `drizzle.config.ts` — **sin cambios**: `schema: "./src/server/db/schema"` toma
  los archivos nuevos por directorio, y `drizzle-kit` abre su propia conexión,
  ajena al cambio de driver de la app.
- `src/app/api/admin/products/route.ts` — forma del `401` y del cuerpo de error
  `{ error: string }` que `requirePermission` debe respetar.
- `src/lib/slug.check.ts` / `src/lib/money.check.ts` + los scripts `check:slug` /
  `check:money` — patrón de self-check con `assert` y `tsx` para T17.

### Cambio de driver

```ts
// src/server/db/index.ts
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

export const db = drizzle(new Pool({ connectionString }), { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
```

Una sola instancia módulo-scope, como hoy. **El pool no se cierra por request.**
`drizzle-orm/neon-serverless/driver.d.ts` confirma que acepta `Pool` como cliente.
`drizzle.config.ts` no cambia: `drizzle-kit` abre su propia conexión.

`Tx` es el tipo que reciben `logAudit` y las funciones transaccionales de los
repositorios. Los repos que hoy usan `db` directo (`category`, `product`) **no se
tocan**: la API de consulta de Drizzle es idéntica entre ambos drivers.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **Sin `ws` ni `@types/ws`** | Instalar `ws` + `neonConfig.webSocketConstructor` | Node local es **v24.19.0** (verificado con `node -v`) y trae `WebSocket` global desde Node 22; Vercel también. Si en runtime aparece "WebSocket constructor missing", se agrega ahí y no antes |
| `PERMISSIONS` como array `{ code, description }` y `resource`/`action` derivados con `code.split(".")` | Tres campos escritos a mano por permiso | 22 permisos × 2 campos redundantes = 44 oportunidades de que el código y la fila diverjan |
| La matriz vive en `src/lib/permissions.ts`, no en el seed | Literal suelto en `seed.ts` | Ahí queda tipada contra `PermissionCode`: un typo en un código no compila. El seed la consume |
| `super_admin: "*"` en la matriz | Listar los 22 códigos | Todo permiso nuevo lo hereda el dueño sin editar dos lugares |
| `requirePermission` devuelve unión discriminada | Lanzar una excepción / `NextResponse` como `throw` | Los handlers actuales ya hacen `if (!userId) return NextResponse...`; el guard es la misma forma y `tsc` obliga a manejar el caso |
| `resolvePermissions` envuelto en `cache()` de React | Consultar en cada llamada | El layout admin de la fase 3 la llama para el guard **y** para filtrar el nav: sin memoización por request son 2 queries idénticas |
| Fallback `customer` resuelto contra la BD (segunda query solo si el usuario no tiene roles) | Devolver `new Set()` a secas | SETUP.md §5.1 regla 3: el default vive en **un** lugar. Hoy `customer` no tiene permisos; si mañana gana `orders.read_own`, funciona sin tocar código |
| Una query con `innerJoin` de 4 tablas para los permisos efectivos | Cargar roles y después permisos | Evita el N+1 obvio |
| `logAudit(tx, entry)` con `tx` **obligatorio** como primer parámetro | `tx` opcional con default `db` | SETUP.md §5.2 regla 2: el log va en la misma transacción que la mutación. Hacerlo opcional invita a llamarlo suelto y perder el rollback |
| `stripSensitive` sobre `changes`/`metadata` | Confiar en el llamador | Es un borde de seguridad (SETUP.md §5.2 regla 3). ~6 líneas, con self-check |
| `assignRole`/`revokeRole` en `user.repository.ts` | Un `user-role.repository.ts` propio | Dos funciones sobre un pivote no justifican un archivo; operan sobre el usuario |
| `check:rbac` en vez de un framework de tests | Vitest | El proyecto ya tiene el patrón `check:slug` / `check:money` con `assert` + `tsx`. No se instala un runner para tres asserts |
| Sin `publicMetadata` de Clerk en esta fase | Escribirlo ya | El chequeo optimista del borde es de la fase 3 y su escritor natural es el webhook (fase 2). Sin escritor, el cache nace desincronizado |

## 9. Tareas

- [x] **T1** — Tabla `users` con índices únicos de `clerk_id` y `email` + tipos inferidos · archivo: `src/server/db/schema/user.ts` · verificación: `npm run typecheck` · **hecho**: tabla `users` con `users_clerk_id_unique` y `users_email_unique`
- [x] **T2** — Tabla `roles` con `slug` único e `is_system` · archivo: `src/server/db/schema/role.ts` · verificación: `npm run typecheck` · **hecho**: tabla `roles` con `roles_slug_unique` e `is_system`
- [x] **T3** — Tabla `permissions` con `code` único · archivo: `src/server/db/schema/permission.ts` · verificación: `npm run typecheck` · **hecho**: tabla `permissions` con `permissions_code_unique`
- [x] **T4** — Pivote `role_permissions` con PK compuesta y FKs `CASCADE` · archivo: `src/server/db/schema/role-permission.ts` · verificación: `npm run typecheck` · **hecho**: pivote con PK `(role_id, permission_id)` y ambas FKs en CASCADE
- [x] **T5** — Pivote `user_roles` con PK compuesta, `assigned_by` y `assigned_at` · archivo: `src/server/db/schema/user-role.ts` · verificación: `npm run typecheck` · **hecho**: pivote con PK `(user_id, role_id)`, `role_id` en RESTRICT e índice `user_roles_user_id_idx`
- [x] **T6** — Enum `audit_severity` + tabla `audit_logs` con las 11 columnas y los 4 índices de SETUP.md §5.2 · archivo: `src/server/db/schema/audit-log.ts` · verificación: `npm run typecheck` · **hecho**: enum `audit_severity` + 11 columnas + los 4 índices (`created_at DESC NULLS LAST`)
- [x] **T7** — Reexportar los 6 módulos nuevos en el barrel · archivo: `src/server/db/schema/index.ts` · verificación: `npm run typecheck` · **hecho**: barrel con los 8 módulos, ordenado alfabéticamente
- [x] **T8** — Cambiar el driver a `neon-serverless` con `Pool` y exportar `type Tx` · archivo: `src/server/db/index.ts` · verificación: `npm run typecheck && npm run build` · **hecho**: `Pool` + `neon-serverless` + `export type Tx`; `db.transaction()` verificado contra Neon (AC11)
- [x] **T9** — Generar y aplicar la migración · comandos: `npm run db:generate && npm run db:migrate` · verificación: `npm run db:studio` muestra las 6 tablas y el enum en Neon · **hecho**: `drizzle/0002_typical_orphan.sql` aplicado; 6 tablas, el enum y los 4 índices confirmados por query
- [x] **T10** — Catálogo `PERMISSIONS` (22 códigos + descripción en español), tipos `PermissionCode` / `RoleSlug`, `ROLES` (slug, nombre, descripción) y matriz `ROLE_PERMISSIONS` · archivo: `src/lib/permissions.ts` · verificación: `npm run typecheck` · **hecho**: 22 permisos, 6 roles, matriz tipada contra `PermissionCode`; `super_admin: "*"`
- [x] **T11** — Repositorio de usuarios: `findByClerkId`, `findById`, `assignRole(tx, ...)`, `revokeRole(tx, ...)` (`onConflictDoNothing` en la asignación) · archivo: `src/server/repositories/user.repository.ts` · verificación: `npm run typecheck` · **hecho**: `findByClerkId` / `findById` / `assignRole(tx, …)` con `onConflictDoNothing` / `revokeRole(tx, …)`
- [x] **T12** — Repositorio de roles: `list()` ordenado, `findBySlug()` · archivo: `src/server/repositories/role.repository.ts` · verificación: `npm run typecheck` · **hecho**: `list()` ordenado por nombre y `findBySlug()`
- [x] **T13** — Repositorio de permisos: `list()`, `listCodesByClerkId()` (un `innerJoin` `users → user_roles → role_permissions → permissions`), `listCodesByRoleSlug()` · archivo: `src/server/repositories/permission.repository.ts` · verificación: `npm run typecheck` · **hecho**: `listCodesByClerkId()` en un solo `innerJoin` de 4 tablas (filtra `is_active`), `listCodesByRoleSlug()`, `list()`
- [x] **T14** — `resolvePermissions(clerkId)` con `cache()` y fallback `customer`, `can(perms, code)` y `requirePermission(code)` devolviendo el `Guard` (401/403) · archivo: `src/lib/permissions.ts` · verificación: `npm run typecheck` · **hecho**: `resolvePermissions` con `cache()` y fallback `customer` leído de la BD, `can`, `requirePermission` con `Guard` 401/403
- [x] **T15** — `getCurrentUser()`, `requireAuth()` y `requirePanelAccess()` (redirige a `/sin-acceso` si falta `dashboard.read`) · archivo: `src/lib/auth.ts` · verificación: `npm run typecheck` · **hecho**: `getCurrentUser` / `requireAuth` (`/sign-in`) / `requirePanelAccess` (`/sin-acceso`), reusando el lookup memoizado
- [x] **T16** — `stripSensitive()` y `logAudit(tx, entry)` que inserta en `audit_logs`; sin `update` ni `delete` en el módulo · archivo: `src/lib/audit.ts` · verificación: `npm run typecheck` · **hecho**: `logAudit(tx, entry)` con `tx` obligatorio y `stripSensitive` recursivo; sin `update` ni `delete` en el módulo
- [x] **T17** — Self-check con `assert`: todo código de la matriz existe en el catálogo, los conteos por rol son 22/20/12/6/8/0, `customer` no tiene `dashboard.read`, y `stripSensitive` enmascara `password`/`token`/`secret` anidados · archivo: `src/lib/rbac.check.ts` + script `check:rbac` en `package.json` · verificación: `npm run check:rbac` · **hecho**: `npm run check:rbac` en verde: 22 permisos, 6 roles, 68 filas, redacción anidada
- [x] **T18** — Seed RBAC idempotente: permisos (derivando `resource`/`action`), 6 roles con `is_system = true`, matriz resuelta por ids, todo con `onConflictDoNothing`; sin borrar el seed de categorías/productos existente · archivo: `src/server/db/seed.ts` · verificación: `npm run db:seed` dos veces seguidas sin error ni duplicados · **hecho**: 1ª corrida 22/6/68 nuevos, 2ª corrida 0/0/0; el seed de categorías y productos quedó intacto
- [x] **T19** — Promoción del super admin en el seed: con `SUPER_ADMIN_CLERK_ID` + `SUPER_ADMIN_EMAIL` inserta/upsertea la fila en `users` y la asigna a `super_admin`; con una sola env, promueve solo si la fila ya existe; sin ninguna, registra el aviso y sigue · archivo: `src/server/db/seed.ts` · verificación: `npm run db:seed` con y sin las envs · **hecho**: probado con las 3 ramas: sin envs avisa y sigue (AC6); con ambas crea y asigna, y la 2ª corrida no duplica (AC5)
- [x] **T20** — Documentar `SUPER_ADMIN_CLERK_ID` y `SUPER_ADMIN_EMAIL` · archivo: `.env.example` · verificación: revisión visual · **hecho**: `SUPER_ADMIN_CLERK_ID` y `SUPER_ADMIN_EMAIL` documentadas con su comportamiento sin valor
- [x] **T21** — Regresión del cambio de driver: `npm run typecheck && npm run lint && npm run build` y `npm run dev` recorriendo `/admin/categories` y `/admin/products` (listar, crear, editar, borrar, slug duplicado → 409) · verificación: los tres comandos en verde y el CRUD funcionando · **hecho**: typecheck ✓ lint ✓ build ✓; listar/crear/editar/borrar y el 409 de slug (`isUniqueViolation` + `violatedConstraint`) verificados contra Neon con el driver nuevo. **Falta el recorrido en el navegador con sesión: lo cierra T22**
- [ ] **T22** — **PAUSA: validación humana.** Revisar en `db:studio` los 22 permisos, los 6 roles y las 68 filas de la matriz, y confirmar que el usuario de `SUPER_ADMIN_*` quedó como `super_admin`. Sin este paso no se cierra la fase ni arranca el spec 005

## 10. Riesgos y consideraciones

- **El cambio de driver es el punto más delicado de la fase.** `neon-http` hace un
  round-trip HTTP por query; `neon-serverless` abre un WebSocket. Si el pool no se
  levanta, **todo** el admin deja de funcionar, no solo lo nuevo. Por eso T21 es una
  tarea propia con recorrido manual, no un `typecheck` suelto.
- **Forma del error de Postgres**: `src/lib/db-errors.ts` lee `code` y `constraint`
  del error (o de su `cause`). Ambos drivers salen de `@neondatabase/serverless`, así
  que la forma debería mantenerse — pero el `409` de slug duplicado es la prueba
  concreta y está en T21. Si cambia, se ajusta `pgErrorCode` (un solo lugar).
- **Latencia**: el WebSocket agrega handshake en el primer request de cada instancia.
  Aceptable a cambio de transacciones; medir si molesta en producción.
- **`users` vacía hasta la fase 2**: cualquier persona con sesión resuelve a
  `customer` (0 permisos). Como el enforcement llega en la fase 3, nadie queda
  bloqueado por esto. Pero el orden importa: **no se puede desplegar la fase 3 sin la
  fase 2**, o el panel queda inaccesible para todos salvo el super admin sembrado.
- **`resolvePermissions` con `cache()` es por request**, no un cache global: un cambio
  de rol se refleja en el request siguiente. Es lo que se quiere (SETUP.md §5.1: ante
  discrepancia gana Postgres).
- **La matriz es dato semilla, no configuración viva**: `onConflictDoNothing` siembra
  pero **no revoca**. Si en el futuro se le quita un permiso a un rol en el código, el
  seed no lo borra de la BD. Documentado acá; el `DELETE` reconciliador se agrega
  cuando haya una segunda edición real de la matriz.
- **Migración aditiva**: rollback = `DROP TABLE audit_logs, user_roles,
  role_permissions, permissions, roles, users` + `DROP TYPE audit_severity`, borrar
  `drizzle/0002_*.sql`, su snapshot y su entrada en `_journal.json`, y revertir
  `src/server/db/index.ts`.
- **`super_admin` con `"*"`**: al agregar un permiso nuevo al catálogo, el dueño lo
  hereda automáticamente. Es intencional; para cualquier otro rol hay que editar la
  matriz a mano.
- **`stripSensitive` es heurístico** (nombres de clave). No sustituye a no pasar
  secretos: la regla sigue siendo que el llamador nunca meta contraseñas en `changes`.
  Relevante en la fase 4, donde se genera una contraseña temporal.

## 11. Fuera de alcance / deuda aceptada

- **Los 10 handlers de admin siguen sin `requirePermission()`** (deuda heredada de los
  specs 002 y 003). `requirePermission` existe pero no tiene consumidores hasta la
  fase 3. Es deliberado: esta fase no debe romper nada en el panel.
- **`requirePanelAccess()` redirige a `/sin-acceso`, una ruta que todavía no existe.**
  Nadie la llama en esta fase; la página se crea en el spec 006.
- **`getCurrentUser()` devuelve `null` para casi todos** hasta que la fase 2 llene
  `users`.
- **Sin escritura de `publicMetadata` en Clerk**: el chequeo optimista del borde no
  puede existir todavía.
- **Purga por retención de `audit_logs`** (180 días para `info`, SETUP.md §5.2 regla 5):
  no hay job. Se agrega cuando la tabla tenga volumen.
- **Vista `/admin/audit-logs`**: otro plan.
- **Permisos `orders.*` y `customers.read` sembrados sin handler que los use**: es
  intencional (plan §"Catálogo de permisos"). Si al cerrar la fase 3 siguen sin
  consumidor, se revisan.
- **Sin reconciliación destructiva del seed** (ver §10).
- **Índice sobre `users.is_active`**: no se agrega sin un listado que filtre por él.
  Llega con la fase 4 si el `GET /api/admin/users` lo necesita.
- **`create()` que miente en su tipo de retorno** (review 002, MENOR-6): los repos
  nuevos siguen el mismo patrón `const [row] = await ...returning()`. Se corrige en
  bloque al encender `noUncheckedIndexedAccess`, no en este spec.
- **`stripSensitive` (`src/lib/audit.ts`) no cubre `privateKey`, `cookie`, `bearer`,
  `jwt`, `session`, `pin`, `cvv`, `ssn`** (review 004, MENOR-1). Ampliar
  `SENSITIVE_KEY` y el self-check **antes del spec 005**, que es el primer consumidor
  real de `logAudit`. Hoy sin consumidores, no urge.
- **Usuario desactivado cae al fallback `customer`** (review 004, MENOR-2):
  `resolvePermissions` no distingue "sin fila / sin rol" de `is_active = false`. Hoy
  `customer` tiene 0 permisos, así que equivale a denegado. Cuando la fase 4 dé
  permisos a `customer`, distinguir ambos casos y devolver `Set` vacío para el
  usuario desactivado.
