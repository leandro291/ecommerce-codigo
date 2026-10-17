---
id: 002
title: Categorías — CRUD de administración
status: done
module: categories
scope: admin
created: 2026-08-28
---

# 002 — Categorías — CRUD de administración

## 1. Contexto

El proyecto tiene auth resuelto (spec 001) pero cero dominio de negocio:
`src/server/db/schema/` está vacío, `drizzle/meta/_journal.json` no registra
ninguna migración, y no existen repositorios, Route Handlers, services ni hooks.
Tampoco existe el área `/admin`: `src/app/(admin)/` no está creada.

Categorías es la primera tabla del catálogo y la dependencia dura de Productos
(FK `products.category_id`). Esta es la Fase 1 del plan aprobado: se construye
completa y el humano la valida a mano antes de arrancar el spec 003 (Productos).

Sirve además como plantilla vertical del proyecto: es la primera vez que se
recorre el flujo completo schema → repo → API → service → hook → UI.

## 2. Objetivo

Un administrador autenticado puede crear, listar, buscar, editar, activar/desactivar
y borrar categorías desde `/admin/categories`, con la tabla persistida en Neon.

## 3. Alcance

### Incluye

- Tabla `categories` en Neon (migración Drizzle generada y aplicada).
- CRUD completo bajo `/api/admin/categories`, validado con Zod.
- Listado con TanStack Table v9: búsqueda global por nombre/slug, filtro por estado
  activo/inactivo, orden por columnas, paginación — todo client-side.
- Shell mínimo del área admin: `src/app/(admin)/admin/layout.tsx` con nav lateral
  (Categorías, Productos).
- Autogeneración del slug desde el nombre, con override manual en el formulario.
- Seed con ~5 categorías de ejemplo.

### No incluye (explícito)

- Subcategorías / jerarquía (`parent_id`). Categorías planas.
- Endpoints públicos de storefront (`/api/categories`) y cualquier vista de cliente.
- Carga de archivos de imagen: solo se guarda una URL en texto.
- Paginación y filtrado server-side.
- Autorización por código de permiso (`requirePermission`) — no existe todavía.
- Auditoría de las mutaciones (`audit_logs` no existe todavía).
- UI para reordenar por `position` (la columna existe y ordena, no se edita drag&drop).
- La página `/admin/products`: el link del nav queda apuntando a una ruta aún inexistente.

## 4. Criterios de aceptación

- [x] AC1 — Dado un admin con sesión, cuando entra a `/admin/categories`, entonces ve
      el shell admin con nav lateral y la tabla de categorías con datos de Neon.
- [x] AC2 — Dado el formulario de creación, cuando escribe "Notebooks Gamer" y no toca
      el campo slug, entonces el slug se autocompleta como `notebooks-gamer`.
- [x] AC3 — Dado el formulario de creación, cuando edita el campo slug a mano, entonces
      el valor manual se respeta y deja de seguir al nombre.
- [x] AC4 — Dado un slug que ya existe, cuando envía el formulario, entonces la API
      responde `409` y la UI muestra el mensaje "Ya existe una categoría con ese slug"
      sin cerrar el diálogo.
- [x] AC5 — Dado el listado, cuando escribe en el buscador, entonces solo quedan las
      filas cuyo nombre o slug contienen el texto (sin recargar ni pedir al servidor).
- [x] AC6 — Dado el listado, cuando selecciona el filtro "Inactivas", entonces solo se
      muestran las categorías con `is_active = false`.
- [x] AC7 — Dado el diálogo de edición, cuando cambia el estado a inactiva y guarda,
      entonces la fila se actualiza en la tabla sin recarga manual (invalidación de query).
- [x] AC8 — Dado el diálogo de borrado, cuando confirma, entonces la categoría
      desaparece del listado y la API respondió `204`.
- [x] AC9 — Dada una petición sin sesión de Clerk a cualquier endpoint de
      `/api/admin/categories`, entonces responde `401` y no toca la base.
      Aceptado en review: la base no se toca por ningún camino. El status exacto
      queda como deuda en §11.
- [x] AC10 — Dado un `POST` con `name` vacío, entonces responde `400` con el detalle
      de Zod y no inserta nada.
- [x] AC11 — Dado el listado mientras carga, entonces se ven `<Skeleton>`; si la
      petición falla, se ve un mensaje de error con botón de reintento.
- [x] AC12 — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Tabla nueva `categories`. **Requiere migración** (`npm run db:generate` +
`npm run db:migrate`). Es la primera migración del proyecto: `drizzle/` solo tiene
`.gitkeep` y un `_journal.json` vacío.

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL, UNIQUE |
| `description` | text | NULL |
| `image_url` | text | NULL |
| `is_active` | boolean | NOT NULL, default `true` |
| `position` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()`, `$onUpdate` |

Índices: `unique(slug)` (nombre `categories_slug_unique`), `index(is_active)`
(nombre `categories_is_active_idx`).

Relaciones: ninguna todavía. En el spec 003, `products.category_id` apuntará acá
con `ON DELETE RESTRICT`.

```ts
// src/server/db/schema/category.ts — firma propuesta
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("categories_slug_unique").on(t.slug), index("categories_is_active_idx").on(t.isActive)],
);

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
```

`src/server/db/index.ts` pasa a `drizzle(neon(connectionString), { schema })`
importando el barrel nuevo `src/server/db/schema/index.ts`.

## 6. Contratos de API

Todos bajo `/api/admin/`, ya cubiertos por `auth.protect()` en `src/proxy.ts`
(verificado: `isAdminRoute` matchea `/api/admin(.*)`). Cada handler revalida la
sesión con `auth()` y responde `401` explícito — defensa en profundidad, no confía
solo en el borde.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/admin/categories?search=&active=` | sesión Clerk | query | `Category[]` | 400, 401, 500 |
| POST | `/api/admin/categories` | sesión Clerk | `CreateCategoryInput` | `Category` (201) | 400, 401, 409, 500 |
| GET | `/api/admin/categories/[id]` | sesión Clerk | — | `Category` | 400, 401, 404, 500 |
| PATCH | `/api/admin/categories/[id]` | sesión Clerk | `UpdateCategoryInput` | `Category` | 400, 401, 404, 409, 500 |
| DELETE | `/api/admin/categories/[id]` | sesión Clerk | — | `204` sin body | 400, 401, 404, 409, 500 |

Semántica de `409`: slug duplicado (unique violation, Postgres `23505`) o categoría
con productos asociados (FK violation, `23503` — aún imposible, la tabla `products`
no existe; la validación queda escrita y activa sola cuando llegue el spec 003).

Cuerpo de error uniforme: `{ error: string; issues?: unknown }`.

`params` se tipa con el helper de Next 16 `RouteContext<'/api/admin/categories/[id]'>`
(verificado en `node_modules/next/dist/docs/.../route.md`); es una `Promise`, se
espera con `await ctx.params`.

Schemas Zod — `src/modules/categories/schemas/category.schema.ts`:

```ts
export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").optional(),
  description: z.string().trim().max(500).nullish(),
  imageUrl: z.url("URL inválida").nullish(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const categoryIdSchema = z.uuid();
```

Salida: no se define schema Zod de respuesta. El tipo de salida es `Category`,
inferido del schema Drizzle (regla 5 de CLAUDE.md); duplicarlo en Zod sería la
segunda fuente de verdad que esa regla prohíbe.

## 7. Arquitectura y archivos afectados

| Capa | Archivo | Estado | Qué hace |
|---|---|---|---|
| Schema | `src/server/db/schema/category.ts` | nuevo | tabla `categories` + tipos inferidos |
| Schema | `src/server/db/schema/index.ts` | nuevo | barrel de reexport |
| DB client | `src/server/db/index.ts` | modificado | pasar `{ schema }` a `drizzle()` |
| Migración | `drizzle/0000_*.sql` | generado | `npm run db:generate` |
| Utils | `src/lib/slug.ts` | nuevo | `slugify(text)` |
| Utils | `src/lib/db-errors.ts` | nuevo | `isUniqueViolation()`, `isForeignKeyViolation()` |
| Repo | `src/server/repositories/category.repository.ts` | nuevo | `list`, `findById`, `create`, `update`, `remove`. Única capa que toca `db` |
| Zod | `src/modules/categories/schemas/category.schema.ts` | nuevo | schemas de entrada + tipos `z.infer` |
| API | `src/app/api/admin/categories/route.ts` | nuevo | `GET`, `POST` |
| API | `src/app/api/admin/categories/[id]/route.ts` | nuevo | `GET`, `PATCH`, `DELETE` |
| Types | `src/modules/categories/types/category.ts` | nuevo | `export type { Category }` desde el schema Drizzle |
| Service | `src/modules/categories/services/category.service.ts` | nuevo | axios vía `api` de `src/lib/axios.ts` |
| Hooks | `src/modules/categories/hooks/use-categories.ts` | nuevo | `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` |
| UI | `src/modules/categories/components/categories-table.tsx` | nuevo | `"use client"` — TanStack Table v9 |
| UI | `src/modules/categories/components/category-form-dialog.tsx` | nuevo | `"use client"` — alta y edición |
| UI | `src/modules/categories/components/delete-category-dialog.tsx` | nuevo | `"use client"` — confirmación |
| Página | `src/app/(admin)/admin/layout.tsx` | nuevo | shell admin (Server Component) + `<Toaster />` |
| Página | `src/app/(admin)/admin/categories/page.tsx` | nuevo | header + botón "Nueva categoría" + tabla |
| Seed | `src/server/db/seed.ts` | modificado | ~5 categorías de ejemplo |

Componentes shadcn ya instalados y suficientes (verificado en `src/components/ui/`):
`button, input, label, card, table, dialog, select, badge, separator, skeleton,
sonner, dropdown-menu, field`. **No hace falta agregar ninguno.**

Query keys: `["categories"]` para la lista, `["categories", id]` para el detalle.
Toda mutación invalida `["categories"]`.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| TanStack Table **v9** con `useTable` + `tableFeatures({ rowSortingFeature, globalFilteringFeature, columnFilteringFeature, rowPaginationFeature, ... })` | API v8 (`useReactTable`, `getCoreRowModel()`) que indica CLAUDE.md §5 | La instalada es `9.2.3` y la v8 no existe en el paquete: `dist/index.d.ts` exporta `useTable`, no `useReactTable`. Grounding: la skill que trae el propio paquete, `node_modules/@tanstack/react-table/skills/getting-started/SKILL.md`. Copiar ejemplos v8 es el error "HIGH" que documenta esa skill. Deuda: alinear CLAUDE.md §5 y SETUP.md ya dice 9.x |
| Filtrado, orden y paginación **client-side** | Server-side con `?search=&active=` | Decenas de categorías, no miles. Un filtro en memoria evita un round-trip por tecla y un `useDebounce` |
| `409` derivado del código de error de Postgres (`23505` / `23503`) | `SELECT` previo por slug antes de insertar | El pre-check tiene race condition y suma una consulta; el índice único ya es la fuente de verdad. Además cubre gratis el FK de productos cuando exista |
| `isUniqueViolation` / `isForeignKeyViolation` en `src/lib/db-errors.ts` | Repetir el `catch` en cada handler / clases de error de dominio | Dos consumidores reales (`route.ts` y `[id]/route.ts`), ~10 líneas, sin jerarquía de clases |
| `slugify` propio (~6 líneas con `normalize("NFD")`) | Dependencia `slugify` / `@sindresorhus/slugify` | Una dependencia nueva para seis líneas. Se le deja un self-check ejecutable |
| El tipo `Category` se reexporta en `src/modules/categories/types/category.ts` | Que cada componente importe de `@/server/db/schema` | Mantiene la regla "el cliente no importa de `server/`" en un único punto de contacto, y ese import es `import type` (se borra en compilación, no arrastra código de servidor al bundle) |
| Un solo `category-form-dialog.tsx` para alta y edición | Dos diálogos | La diferencia es el `defaultValues` y el mutation hook. Dos archivos sería duplicación literal |
| `<Toaster />` montado en el layout admin | Montarlo en el root layout | Hoy no está montado en ningún lado; el único consumidor es el admin. Sube al root cuando el storefront lo necesite |
| Handlers revalidan sesión con `auth()` además del borde | Confiar solo en `proxy.ts` | Un endpoint no debe depender de la configuración de un matcher para no filtrar datos |
| Autorización solo por sesión, sin `requirePermission()` | Implementar RBAC acá | Decisión explícita del usuario: `users`/`roles`/`permissions` no existen. Queda como deuda en §11 |

## 9. Tareas

- [x] **T1** — Definir la tabla `categories` con sus índices y tipos inferidos · archivo: `src/server/db/schema/category.ts` · verificación: `npm run typecheck`
- [x] **T2** — Crear el barrel de schema y pasar `{ schema }` al cliente Drizzle · archivos: `src/server/db/schema/index.ts`, `src/server/db/index.ts` · verificación: `npm run typecheck`
- [x] **T3** — Generar y aplicar la migración · comandos: `npm run db:generate && npm run db:migrate` · verificación: `npm run db:studio` muestra la tabla `categories` en Neon
      `db:generate` → `drizzle/0000_dapper_boomer.sql` (tabla + `categories_slug_unique` + `categories_is_active_idx`).
      `db:migrate` aplicado con éxito a Neon real (host `ep-dark-band-...aws.neon.tech`) el 2026-08-28.
- [x] **T4** — `slugify(text)`: minúsculas, sin acentos (`normalize("NFD")`), no alfanuméricos → `-`, sin guiones repetidos ni en los bordes · archivo: `src/lib/slug.ts` · verificación: `npm run typecheck` + self-check con `assert` sobre "Notebooks Gamer", "Cámaras & Drones", "  --Audio--  "
- [x] **T5** — Predicados `isUniqueViolation` / `isForeignKeyViolation` sobre el código de error de Postgres · archivo: `src/lib/db-errors.ts` · verificación: `npm run typecheck`
- [x] **T6** — Repositorio con `list(filters)`, `findById`, `create`, `update`, `remove`; `list` ordena por `position asc, name asc` · archivo: `src/server/repositories/category.repository.ts` · verificación: `npm run typecheck`
- [x] **T7** — Schemas Zod de entrada + tipos `z.infer` · archivo: `src/modules/categories/schemas/category.schema.ts` · verificación: `npm run typecheck`
- [x] **T8** — `GET` (query validada, filtros opcionales) y `POST` (201, slug autogenerado si no viene, 409 si duplicado) · archivo: `src/app/api/admin/categories/route.ts` · verificación: `npm run typecheck` + `curl` autenticado
- [x] **T9** — `GET` / `PATCH` / `DELETE` por id, con 404 y 409 · archivo: `src/app/api/admin/categories/[id]/route.ts` · verificación: `npm run typecheck` + `curl`
- [x] **T10** — Reexportar el tipo `Category` para el módulo cliente · archivo: `src/modules/categories/types/category.ts` · verificación: `npm run typecheck`
- [x] **T11** — Service axios tipado (`listCategories`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory`) · archivo: `src/modules/categories/services/category.service.ts` · verificación: `npm run typecheck`
- [x] **T12** — Hooks de TanStack Query con invalidación de `["categories"]` · archivo: `src/modules/categories/hooks/use-categories.ts` · verificación: `npm run typecheck`
- [x] **T13** — Shell admin: nav lateral (Categorías, Productos) + `<Toaster />`, Server Component sin `"use client"` · archivo: `src/app/(admin)/admin/layout.tsx` · verificación: `npm run build`
- [x] **T14** — Tabla con `useTable` v9: columnas nombre/slug/estado/posición/acciones, buscador global, `<Select>` de estado, orden, paginación, `<Skeleton>` de carga y estado de error con reintento · archivo: `src/modules/categories/components/categories-table.tsx` · verificación: `npm run lint`
- [x] **T15** — Diálogo de alta/edición con React Hook Form + `zodResolver`, slug autogenerado que deja de seguir al nombre al editarse a mano, mapeo del 409 a error de campo · archivo: `src/modules/categories/components/category-form-dialog.tsx` · verificación: `npm run lint`
- [x] **T16** — Diálogo de confirmación de borrado · archivo: `src/modules/categories/components/delete-category-dialog.tsx` · verificación: `npm run lint`
- [x] **T17** — Página que compone header, botón "Nueva categoría" y la tabla · archivo: `src/app/(admin)/admin/categories/page.tsx` · verificación: `npm run build`
- [x] **T18** — Seed idempotente con ~5 categorías de ejemplo (`onConflictDoNothing` por slug) · archivo: `src/server/db/seed.ts` · verificación: `npm run db:seed` dos veces seguidas sin error ni duplicados
      Corrido 2× el 2026-08-28: 1ª vez "5 categorías nuevas de 5"; 2ª vez "0 categorías nuevas de 5". Idempotente.
- [x] **T19** — **PAUSA: validación humana.** `npm run dev` y recorrer a mano `/admin/categories`: crear (slug autogenerado), editar, desactivar y verlo en el filtro, slug duplicado → 409, borrar, buscar por nombre y por slug, estados de carga y error. Ningún cierre de fase sin este paso · **validado por el usuario el 2026-08-28** (dio inicio a la Fase 2)

## 10. Riesgos y consideraciones

- **Slug duplicado en concurrencia**: dos altas simultáneas con el mismo slug. El
  índice único de Postgres es la garantía; el handler traduce `23505` a `409`. No se
  pre-consulta.
- **Borrado con productos asociados**: hoy imposible (no hay `products`). El mapeo
  `23503 → 409` queda escrito para que funcione solo cuando el spec 003 cree la FK
  con `ON DELETE RESTRICT`. Si el spec 003 la crea con `CASCADE`, este contrato se
  rompe en silencio: es un punto a revisar allá.
- **`image_url` es texto libre**: se valida como URL con Zod, pero cualquier dominio
  es aceptado y se renderiza. No se muestra como `<img>` remota sin configurar
  `images.remotePatterns`; en esta fase se muestra como texto/enlace.
- **Superficie de autorización**: cualquier usuario **autenticado** —incluido un
  cliente del storefront— puede llamar a `/api/admin/categories`. Es una decisión
  consciente y acotada de esta fase; ver §11. No se despliega a producción con datos
  reales antes de cerrar el RBAC.
- **Mutaciones sin traza**: sin `audit_logs`, un borrado no deja rastro de quién fue.
- **Tabla client-side**: trae todas las categorías en una sola respuesta. Con pocas
  decenas es irrelevante; con cientos empieza a pesar el payload.
- **`next-themes` sin `ThemeProvider`**: `sonner.tsx` usa `useTheme()`. Sin provider
  cae al default `"system"` y no rompe — pero no hay que asumir que el tema funciona.
- **Rollback**: la migración es aditiva (una tabla nueva). Revertir es `DROP TABLE
  categories` + borrar el archivo de `drizzle/` y su entrada en `_journal.json`.

## 11. Fuera de alcance / deuda aceptada

- **`requirePermission()` y RBAC**: `src/lib/permissions.ts` no existe y `users`,
  `roles`, `permissions` no están creadas. CLAUDE.md regla 8 y SETUP.md §6 exigen
  verificación por código de permiso en los handlers de `/api/admin/`. **Este spec
  la incumple a sabiendas por decisión del usuario.** Se retoma en el spec de RBAC;
  al cerrarlo hay que volver sobre los cinco handlers de categorías.
- **`audit_logs`**: las mutaciones no se auditan (la tabla no existe). CLAUDE.md
  regla 9 queda pendiente hasta el spec de auditoría.
- **Filtros server-side del endpoint sin consumidor**: el `GET` acepta `?search=` y
  `?active=` pero la tabla filtra en el navegador. Quedan porque los va a usar el
  storefront; si al cerrar la Fase 2 siguen sin ningún consumidor, se borran.
- **Paginación server-side**: cuando el listado pase de ~500 filas.
- **Jerarquía de categorías** (`parent_id`): se agrega con una migración si el
  negocio lo pide.
- **Carga de archivos de imagen y galería**: solo URL de texto.
- **Reordenar por `position` desde la UI**: la columna existe y ordena, pero se edita
  como número en el formulario. Drag & drop, si alguna vez molesta.
- **`data-table` compartido en `src/components/shared/`**: no se extrae con un solo
  consumidor. Se evalúa en el spec 003, cuando exista la segunda tabla.
- **Link "Productos" del nav apuntando a una ruta inexistente**: se resuelve en el
  spec 003. Mientras tanto queda deshabilitado en el nav.
- **CLAUDE.md §5 dice TanStack Table v8**: la instalada es v9 y SETUP.md ya dice 9.x.
  Corregir CLAUDE.md queda fuera del alcance de este spec.
- **`/api/*` responde `307` en vez de `401` sin sesión** (review 002, AC9): el borde
  (`proxy.ts` → `auth.protect()`) redirige a `/sign-in` con `307`
  (`x-clerk-auth-reason: dev-browser-missing`) antes de que corra el handler. La base
  no se toca por ningún camino y el `401` de cada handler sigue siendo defensa en
  profundidad, observable solo si el matcher no cubriera la ruta. Se resuelve
  devolviendo `401` para `/api/*` desde `proxy.ts`; queda fuera de §7 de este spec.
- **`axios` filtrado a la UI** (review 002, MENOR-3): `category-form-dialog.tsx` y
  `delete-category-dialog.tsx` importan `axios.isAxiosError` para leer status y
  mensaje de error. El transporte no debería llegar a los componentes. Extraer
  `getApiErrorMessage()` / `isConflict()` cuando aparezca el tercer consumidor
  (probablemente el spec 003, Productos).
- **`<th>` sin `aria-sort`** (review 002, MENOR-5): las columnas ordenables de
  `categories-table.tsx` no exponen el estado de orden a lectores de pantalla.
  Mapear `header.column.getIsSorted()` a `aria-sort` en el `<TableHead>`.
- **`create()` miente en su tipo de retorno** (review 002, MENOR-6):
  `category.repository.ts` declara `Promise<Category>` sobre
  `const [category] = await ...returning()`, que es `Category | undefined`. Solo
  compila porque `noUncheckedIndexedAccess` está apagado. El `INSERT ... RETURNING`
  siempre devuelve una fila, así que no hay bug real; se corrige al encender el flag
  (o con un guard explícito) junto con el resto del repositorio.
