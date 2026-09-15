---
id: 003
title: Productos — CRUD de administración
status: in-review
module: products
scope: admin
created: 2026-08-28
---

# 003 — Productos — CRUD de administración

## 1. Contexto

La Fase 1 (spec 002) dejó `categories` en Neon, la primera migración aplicada
(`drizzle/0000_dapper_boomer.sql`), el shell admin (`src/app/(admin)/admin/layout.tsx`)
y el recorrido vertical completo schema → repo → API → service → hook → UI.
El usuario validó a mano `/admin/categories` el 2026-08-28 y dio inicio a la Fase 2.

Productos es la segunda tabla del catálogo y la que cierra la FK pendiente:
`products.category_id → categories.id ON DELETE RESTRICT`. Esa FK activa el mapeo
`23503 → 409` que el spec 002 dejó escrito sin poder ejercitar (§10 de 002).

Diferencias reales con la Fase 1, y por lo tanto lo único que hay que pensar acá:
JOIN en el `list` para no hacer N+1, dinero en centavos con conversión en el borde
de la UI, filtro por categoría en la tabla, y la decisión DRY sobre extraer un
`data-table` compartido ahora que existe la segunda tabla.

## 2. Objetivo

Un administrador autenticado puede crear, listar, buscar, filtrar, editar y borrar
productos desde `/admin/products`, con el precio persistido en centavos y cada
producto asociado a una categoría existente.

## 3. Alcance

### Incluye

- Tabla `products` en Neon con FK a `categories` (migración generada y aplicada).
- CRUD completo bajo `/api/admin/products`, validado con Zod.
- Listado con TanStack Table v9: búsqueda global por nombre/SKU, filtro por
  categoría, filtro por estado activo/inactivo, orden y paginación — client-side.
- Conversión pesos ↔ centavos en un único lugar (`src/lib/money.ts`) con self-check.
- Página `/admin/products` y activación del link "Productos" del nav admin.
- Extracción de `getApiErrorMessage` / `isConflict` a `src/lib/api-error.ts`
  (tercer y cuarto consumidor: salda la deuda MENOR-3 del review 002).
- Seed con ~8 productos de ejemplo ligados a las categorías ya sembradas.

### No incluye (explícito)

- Galería multi-imagen y carga de archivos: sigue siendo una `image_url` de texto.
- Endpoints públicos de storefront (`/api/products`) y cualquier vista de cliente.
- Paginación y filtrado server-side.
- Autorización por código de permiso (`requirePermission`) — sigue sin existir.
- Auditoría de las mutaciones (`audit_logs` no existe todavía).
- Variantes, atributos, specs técnicas, historial de precios.
- Extracción de `src/components/shared/data-table.tsx` (ver §8, decisión razonada).

## 4. Criterios de aceptación

- [ ] AC1 — Dado un admin con sesión, cuando entra a `/admin/products`, entonces ve
      la tabla con los productos de Neon y una columna con el **nombre** de la
      categoría de cada uno.
- [ ] AC2 — Dado el nav admin, cuando se carga cualquier página de `/admin`, entonces
      "Productos" es un `<Link>` navegable a `/admin/products` (hoy es un `<span>`
      deshabilitado).
- [ ] AC3 — Dado el formulario de creación, cuando escribe "Notebook Lenovo IdeaPad"
      y no toca el slug, entonces el slug se autocompleta como `notebook-lenovo-ideapad`.
- [ ] AC4 — Dado el formulario, cuando carga el precio `1299.99` y guarda, entonces la
      fila en Neon tiene `price = 129999` (entero, verificable con `db:studio`).
- [ ] AC5 — Dado el listado, cuando se renderiza un producto con `price = 129999`,
      entonces la celda muestra `$ 1.299,99`.
- [ ] AC6 — Dado un `POST` con un `categoryId` uuid válido pero inexistente, entonces
      responde `400` con "La categoría indicada no existe" y no inserta nada.
- [ ] AC7 — Dado un `slug` o un `sku` ya usados, cuando envía el formulario, entonces
      la API responde `409` y la UI marca el campo correspondiente sin cerrar el diálogo.
- [ ] AC8 — Dada una categoría con al menos un producto, cuando se la intenta borrar
      desde `/admin/categories`, entonces responde `409` "La categoría tiene productos
      asociados" y la categoría sigue existiendo (verifica `ON DELETE RESTRICT`).
- [ ] AC9 — Dado el listado, cuando escribe en el buscador, entonces solo quedan las
      filas cuyo nombre o SKU contienen el texto.
- [ ] AC10 — Dado el listado, cuando elige una categoría en el `<Select>`, entonces
      solo se muestran los productos de esa categoría; combinado con el filtro de
      estado, ambos se aplican a la vez.
- [ ] AC11 — Dado el listado mientras carga, entonces se ven `<Skeleton>`; si la
      petición falla, se ve un mensaje de error con botón de reintento.
- [ ] AC12 — Dado un `PATCH` con body `{}`, entonces responde `400` y no toca la base.
- [x] AC13 — `npm run check:money` en verde (conversión pesos↔centavos sin error de
      punto flotante).
- [ ] AC14 — `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

Tabla nueva `products`. **Requiere migración** (`npm run db:generate` +
`npm run db:migrate`). Es la segunda migración del proyecto: aditiva, no toca
`categories`.

| Columna | Tipo | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL, UNIQUE |
| `description` | text | NULL |
| `category_id` | uuid | NOT NULL, FK → `categories.id` **ON DELETE RESTRICT** |
| `price` | integer | NOT NULL — **centavos**, nunca float |
| `compare_at_price` | integer | NULL — precio anterior / oferta, en centavos |
| `sku` | text | NULL, UNIQUE |
| `stock` | integer | NOT NULL, default `0` |
| `image_url` | text | NULL |
| `is_active` | boolean | NOT NULL, default `true` |
| `is_featured` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL, default `now()`, `$onUpdate` |

Índices: `unique(slug)` (`products_slug_unique`), `unique(sku)` (`products_sku_unique`),
`index(category_id)` (`products_category_id_idx`), `index(is_active)`
(`products_is_active_idx`).

```ts
// src/server/db/schema/product.ts — firma propuesta
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    sku: text("sku"),
    stock: integer("stock").notNull().default(0),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    uniqueIndex("products_sku_unique").on(t.sku),
    index("products_category_id_idx").on(t.categoryId),
    index("products_is_active_idx").on(t.isActive),
  ],
);

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
// Fila que devuelve `list()`: el producto + el nombre de su categoría (JOIN).
export type ProductListItem = Product & { categoryName: string };
```

`src/server/db/schema/index.ts` agrega `export * from "./product";`.

## 6. Contratos de API

Todos bajo `/api/admin/`, cubiertos por `auth.protect()` en `src/proxy.ts`
(`isAdminRoute` matchea `/api/admin(.*)`). Cada handler revalida con `auth()` y
responde `401` explícito, igual que categorías.

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| GET | `/api/admin/products` | sesión Clerk | — | `ProductListItem[]` | 401, 500 |
| POST | `/api/admin/products` | sesión Clerk | `CreateProductInput` | `Product` (201) | 400, 401, 409, 500 |
| GET | `/api/admin/products/[id]` | sesión Clerk | — | `Product` | 400, 401, 404, 500 |
| PATCH | `/api/admin/products/[id]` | sesión Clerk | `UpdateProductInput` | `Product` | 400, 401, 404, 409, 500 |
| DELETE | `/api/admin/products/[id]` | sesión Clerk | — | `204` sin body | 400, 401, 404, 500 |

Semántica de los errores de Postgres en este dominio:

- `23505` (unique) → **409**. Mensaje según la constraint: `products_slug_unique`
  → "Ya existe un producto con ese slug"; `products_sku_unique` → "Ya existe un
  producto con ese SKU". Se distingue leyendo `constraint` del error.
- `23503` (FK) en `POST`/`PATCH` → **400** "La categoría indicada no existe".

Cuerpo de error uniforme: `{ error: string; issues?: unknown }`.
`params` con `RouteContext<'/api/admin/products/[id]'>` (Promise, se espera).

Schemas Zod — `src/modules/products/schemas/product.schema.ts`:

```ts
// Base SIN refinamientos: es la única que puede .extend() / .partial().
const productFields = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").optional(),
  description: z.string().trim().max(2000).nullish(),
  categoryId: z.uuid("Categoría inválida"),
  price: z.number().int("El precio debe estar en centavos").min(0).max(1_000_000_00),
  compareAtPrice: z.number().int().min(0).max(1_000_000_00).nullish(),
  sku: z.string().trim().min(2).max(60).nullish(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.url("URL inválida").nullish(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

const compareAtIsHigher = ...; // refine: si vienen los dos, compareAtPrice > price

export const createProductSchema = productFields.refine(compareAtIsHigher, {...});
export const updateProductSchema = productFields.partial().refine(nonEmpty).refine(compareAtIsHigher, {...});
export const productIdSchema = z.uuid("Identificador inválido");

// Formulario: mismos campos, precios en PESOS con decimales.
export const productFormSchema = productFields
  .extend({ price: pesos, compareAtPrice: pesos.nullish() })
  .refine(compareAtIsHigher, {...});
```

Salida sin schema Zod: el tipo es `Product` / `ProductListItem`, inferido de Drizzle
(regla 5 de CLAUDE.md).

## 7. Arquitectura y archivos afectados

| Capa | Archivo | Estado | Qué hace |
|---|---|---|---|
| Schema | `src/server/db/schema/product.ts` | nuevo | tabla `products` + tipos inferidos |
| Schema | `src/server/db/schema/index.ts` | modificado | `export * from "./product"` |
| Migración | `drizzle/0001_*.sql` | generado | `npm run db:generate` |
| Utils | `src/lib/money.ts` | nuevo | `toCents`, `fromCents`, `formatPrice` |
| Utils | `src/lib/money.check.ts` | nuevo | self-check con `assert` |
| Utils | `src/lib/api-error.ts` | nuevo | `getApiErrorMessage`, `isConflict` — único punto que importa `axios` en cliente |
| Utils | `src/lib/db-errors.ts` | modificado | `violatedConstraint()` para distinguir slug vs SKU en el 409, y `isForeignKeyViolation()` extendido a `23001` (ver §10) |
| Repo | `src/server/repositories/product.repository.ts` | nuevo | `list` (JOIN a `categories`), `findById`, `create`, `update`, `remove` |
| Zod | `src/modules/products/schemas/product.schema.ts` | nuevo | schemas de API + de formulario |
| API | `src/app/api/admin/products/route.ts` | nuevo | `GET`, `POST` |
| API | `src/app/api/admin/products/[id]/route.ts` | nuevo | `GET`, `PATCH`, `DELETE` |
| Types | `src/modules/products/types/product.ts` | nuevo | reexport de `Product` y `ProductListItem` |
| Service | `src/modules/products/services/product.service.ts` | nuevo | axios + conversión pesos → centavos |
| Hooks | `src/modules/products/hooks/use-products.ts` | nuevo | `useProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct` |
| UI | `src/modules/products/components/products-table.tsx` | nuevo | `"use client"` — TanStack Table v9 |
| UI | `src/modules/products/components/product-form-dialog.tsx` | nuevo | `"use client"` — alta y edición |
| UI | `src/modules/products/components/delete-product-dialog.tsx` | nuevo | `"use client"` — confirmación |
| UI | `src/modules/categories/components/category-form-dialog.tsx` | modificado | usa `api-error.ts` en vez de `axios` |
| UI | `src/modules/categories/components/delete-category-dialog.tsx` | modificado | idem |
| Página | `src/app/(admin)/admin/layout.tsx` | modificado | el `<span>` "Productos" pasa a `<Link>` |
| Página | `src/app/(admin)/admin/products/page.tsx` | nuevo | header + botón "Nuevo producto" + tabla |
| Seed | `src/server/db/seed.ts` | modificado | ~8 productos de ejemplo |
| Config | `package.json` | modificado | script `check:money` |

Componentes shadcn ya instalados y suficientes (verificado en `src/components/ui/`).
`isActive` / `isFeatured` se editan con `<Select>` como en categorías: **no hace falta
instalar `switch` ni `checkbox`**.

Query keys: `["products"]` para la lista, `["products", id]` para el detalle. Toda
mutación invalida `["products"]`. El filtro de categoría de la tabla consume
`useCategories()` del módulo categorías (ya existe, ya cachea bajo `["categories"]`).

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **No** se extrae `src/components/shared/data-table.tsx` | Genérico compartido entre `categories-table` y `products-table` | CLAUDE.md §6: se extrae a la tercera repetición. Lo común son ~40 líneas de shell de render; lo distinto son columnas, features, filtros y estados vacíos. Con dos consumidores la abstracción nace con props de configuración por cada diferencia — más código, no menos. Se reevalúa con la tercera tabla (pedidos) |
| `getApiErrorMessage` / `isConflict` en `src/lib/api-error.ts` | Seguir importando `axios` en cada diálogo | Acá aparecen el 3.º y 4.º consumidor: la regla de la tercera repetición sí se cumple. Salda MENOR-3 del review 002 y saca el transporte de los componentes |
| `category_id` inexistente → **400 desde el `23503`** del insert | `SELECT` previo a `categories` en cada `POST`/`PATCH` | El pre-check tiene race condition (la categoría puede borrarse entre el SELECT y el INSERT) y suma un round-trip. La FK ya es la fuente de verdad. Mismo criterio que el `23505` del spec 002 |
| `list()` con un solo `innerJoin` a `categories` devolviendo `categoryName` | `list()` de productos + un `findById` de categoría por fila | N+1 explícito. Un JOIN, una consulta |
| `GET /api/admin/products` **sin** query params | Paridad con `?search=&active=` de categorías | La tabla filtra en el navegador: esos params no tendrían consumidor. El spec 002 ya arrastra esa deuda (§11 de 002); no se duplica. Se agregan junto con la paginación server-side, en su propio spec |
| Conversión pesos → centavos en el **service** (`toCents`) | Convertir en el componente, o mandar pesos y convertir en el handler | El componente no debe saber de unidades de transporte y el servidor no debe recibir floats de dinero. El service es el borde exacto donde el formulario deja de ser formulario |
| `Math.round(pesos * 100)` con self-check ejecutable | `Math.trunc`, o una librería de decimales | `19.99 * 100 === 1998.9999...`: `trunc` pierde un centavo. `round` es correcto en el rango de precios de un e-commerce. El check lo fija |
| `productFields` base sin refinamientos, y `create`/`update`/`form` derivados de ella | Un solo schema con `.refine` y luego `.extend`/`.partial` | En Zod, `.extend()` y `.partial()` no están disponibles sobre un schema ya refinado. Derivar de la base evita reescribir los campos tres veces |
| Filtro por categoría con `filterFn` que lee `row.original.categoryId`, sobre la columna visible `categoryName` | Columna oculta `categoryId` + `columnVisibilityFeature` | El `<Select>` guarda ids (estables), la tabla muestra nombres, y no hace falta sumar una feature más a `tableFeatures` |
| `sku` nullable + unique | `sku` obligatorio | Postgres admite múltiples `NULL` en un índice único: los productos sin SKU no colisionan entre sí. No todo producto de catálogo tiene SKU cargado el día uno |
| Se reusa `slugify` de `src/lib/slug.ts` | Un slugify propio del módulo | Ya existe y está verificado |

## 9. Tareas

- [x] **T1** — Definir la tabla `products` con FK, índices y tipos inferidos (incluye
      `ProductListItem`); agregar el reexport al barrel · archivos:
      `src/server/db/schema/product.ts`, `src/server/db/schema/index.ts` ·
      verificación: `npm run typecheck`
      Tabla con los 14 campos, FK `onDelete: "restrict"`, 4 índices y los tres tipos
      inferidos. `typecheck` en verde.
- [x] **T2** — Generar y aplicar la migración · comandos: `npm run db:generate &&
      npm run db:migrate` · verificación: `npm run db:studio` muestra `products` en Neon
      con la FK a `categories`
      `db:generate` → `drizzle/0001_mighty_dark_beast.sql`. Aplicada a Neon el 2026-08-28.
      Verificado por consulta a `information_schema` en vez del studio interactivo:
      14 columnas, `delete_rule: RESTRICT` en `products_category_id_categories_id_fk`,
      índices `products_slug_unique`, `products_sku_unique`, `products_category_id_idx`,
      `products_is_active_idx`.
- [x] **T3** — `toCents`, `fromCents` y `formatPrice` (es-AR / ARS) + self-check con
      `assert` (`toCents(19.99) === 1999`, `toCents(1299.99) === 129999`,
      `fromCents(129999) === 1299.99`) + script `check:money` · archivos:
      `src/lib/money.ts`, `src/lib/money.check.ts`, `package.json` ·
      verificación: `npm run check:money`
      Self-check incluye además `toCents(0.1 + 0.2) === 30` y un ida y vuelta sobre
      cuatro precios. `formatPrice(129999)` → `"$ 1.299,99"` (AC5). `check:money` ok.
- [x] **T4** — `getApiErrorMessage(error, fallback)` e `isConflict(error)`; reemplazar
      los usos directos de `axios` en los dos diálogos de categorías · archivos:
      `src/lib/api-error.ts`, `src/modules/categories/components/category-form-dialog.tsx`,
      `src/modules/categories/components/delete-category-dialog.tsx` ·
      verificación: `npm run typecheck && npm run lint`
      `axios` ya no se importa en ningún componente: MENOR-3 del review 002 saldada.
- [x] **T5** — Repositorio con `list()` (innerJoin a `categories`, select explícito de
      columnas + `categories.name as categoryName`, orden `name asc`), `findById`,
      `create`, `update`, `remove` · archivo:
      `src/server/repositories/product.repository.ts` · verificación: `npm run typecheck`
- [x] **T6** — Schemas Zod: `productFields` base, `createProductSchema`,
      `updateProductSchema`, `productFormSchema` (pesos), `productIdSchema` y tipos
      `z.infer` · archivo: `src/modules/products/schemas/product.schema.ts` ·
      verificación: `npm run typecheck`
      `compareAtIsHigher` compartido por los tres schemas; en `update` solo evalúa si
      llegan ambos precios, como fija §10.
- [x] **T7** — `GET` (lista con categoría) y `POST` (201, slug autogenerado si no viene,
      409 slug/SKU duplicado distinguiendo la constraint, 400 si la categoría no existe) ·
      archivo: `src/app/api/admin/products/route.ts` · verificación: `npm run typecheck`
      + `curl` autenticado
      La distinción de constraint quedó en `violatedConstraint()` de `src/lib/db-errors.ts`:
      `route.ts` de Next solo admite exports de handlers, así que el helper no podía
      vivir en el propio archivo. Verificado contra Neon: el driver expone
      `products_slug_unique` / `products_sku_unique` en el error.
- [x] **T8** — `GET` / `PATCH` / `DELETE` por id, con 404, 409 y 400 de FK · archivo:
      `src/app/api/admin/products/[id]/route.ts` · verificación: `npm run typecheck` + `curl`
- [x] **T9** — Reexportar `Product` y `ProductListItem` para el módulo cliente · archivo:
      `src/modules/products/types/product.ts` · verificación: `npm run typecheck`
- [x] **T10** — Service axios tipado (`listProducts`, `getProduct`, `createProduct`,
      `updateProduct`, `deleteProduct`) que aplica `toCents` a `price` y
      `compareAtPrice` antes de enviar · archivo:
      `src/modules/products/services/product.service.ts` · verificación: `npm run typecheck`
      `toPayload()` es el único cruce pesos → centavos; `compareAtPrice` null se
      preserva sin convertir.
- [x] **T11** — Hooks de TanStack Query con invalidación de `["products"]` · archivo:
      `src/modules/products/hooks/use-products.ts` · verificación: `npm run typecheck`
- [x] **T12** — Tabla `useTable` v9: columnas nombre / SKU / categoría / precio
      (`formatPrice`) / stock / estado / acciones; buscador global limitado a nombre y
      SKU; `<Select>` de categoría poblado con `useCategories()`; `<Select>` de estado;
      orden con `aria-sort` en los `<TableHead>` ordenables; `<Skeleton>` de carga y
      estado de error con reintento · archivo:
      `src/modules/products/components/products-table.tsx` · verificación: `npm run lint`
      `setFilter()` actualiza un filtro sin pisar el otro, para que categoría y estado
      se combinen (AC10). El accessor de SKU usa `?? ""` para que el buscador global no
      matchee el string `"null"` en los productos sin SKU.
- [x] **T13** — Diálogo de alta/edición con React Hook Form + `zodResolver(productFormSchema)`:
      slug autogenerado que deja de seguir al nombre al editarse, precios en pesos
      (`fromCents` en los defaults), `<Select>` de categoría, de estado y de destacado,
      mapeo del 409 a error de campo (slug o SKU según el mensaje) · archivo:
      `src/modules/products/components/product-form-dialog.tsx` · verificación: `npm run lint`
- [x] **T14** — Diálogo de confirmación de borrado · archivo:
      `src/modules/products/components/delete-product-dialog.tsx` · verificación: `npm run lint`
- [x] **T15** — Página que compone header, botón "Nuevo producto" y la tabla · archivo:
      `src/app/(admin)/admin/products/page.tsx` · verificación: `npm run build`
      Server Component sin `"use client"`; el `build` lo corre el reviewer.
- [x] **T16** — Activar el link "Productos" del nav (el `<span aria-disabled>` pasa a
      `<Link href="/admin/products">`) · archivo: `src/app/(admin)/admin/layout.tsx` ·
      verificación: `npm run build`
- [x] **T17** — Seed idempotente de ~8 productos: resuelve los `category_id` por slug de
      categoría, corre después del seed de categorías, `onConflictDoNothing` por slug,
      precios en centavos · archivo: `src/server/db/seed.ts` · verificación:
      `npm run db:seed` dos veces seguidas sin error ni duplicados
      Corrido 2× el 2026-08-28: 1ª vez "8 productos nuevos de 8"; 2ª vez "0 de 8".
      Un producto va sin SKU a propósito (varios NULL no colisionan en el índice único).
      Todos los precios por debajo del máximo del schema Zod, para que sean editables
      desde el formulario sin fallar validación.
- [ ] **T18** — **PAUSA: validación humana.** `npm run dev` y recorrer a mano
      `/admin/products`: crear con precio decimal y verificar los centavos en
      `db:studio`, editar, buscar por nombre y por SKU, filtrar por categoría y por
      estado, slug y SKU duplicados → 409, categoría inexistente → 400, borrar producto,
      e intentar borrar en `/admin/categories` una categoría con productos → 409.
      Ningún cierre de fase sin este paso

Verificación final de la fase: `npm run typecheck && npm run lint && npm run check:money`
(el `build` lo corre el reviewer).

## 10. Riesgos y consideraciones

- **Precio en punto flotante**: el único lugar donde un peso se vuelve centavo es
  `toCents`. Si aparece un segundo `* 100` en el código, es un bug esperando. El
  `check:money` es la red.
- **`compare_at_price` en centavos igual que `price`**: se validan con la misma
  unidad. En `PATCH` parcial, la regla "compareAtPrice > price" solo se puede evaluar
  si llegan los dos campos; si llega uno solo, no se valida contra el valor guardado.
  Aceptado: es cosmética de marketing, no una invariante de negocio.
- **`ON DELETE RESTRICT` confirma el contrato de 002**: el spec 002 avisó que si esta
  FK se creaba con `CASCADE` su `409` se rompía en silencio. Se crea con `RESTRICT`,
  como estaba previsto. AC8 lo ejercita.
- **Hallazgo al ejercitar AC8 — `23001` ≠ `23503`**: Postgres distingue el sentido de
  la violación referencial. Un `INSERT` con `category_id` inexistente da `23503`
  (foreign_key_violation), pero un `DELETE` bloqueado por `ON DELETE RESTRICT` da
  **`23001`** (restrict_violation), porque `RESTRICT` dispara su propio trigger. El
  `isForeignKeyViolation()` que 002 dejó escrito solo cubría `23503`: con la FK ya
  creada, el `DELETE /api/admin/categories/[id]` habría respondido `500` en vez del
  `409` que exige AC8. Se corrigió en `src/lib/db-errors.ts` — un solo punto, todos
  los handlers routean por ahí — y se verificó contra Neon que ambos caminos mapean:
  delete restringido → `409`, insert con categoría inexistente → `400`, y la categoría
  queda intacta. Es exactamente el riesgo que 002 anticipó, materializado en un código
  de error distinto al previsto.
- **`sku` único con `NULL`s**: dos productos sin SKU no colisionan (comportamiento
  estándar de Postgres). No se confunda con "el SKU es opcional pero único cuando existe".
- **Migración `0001`**: aditiva. Rollback = `DROP TABLE products` + borrar el archivo
  de `drizzle/` y su entrada en `_journal.json`.
- **Tabla client-side**: trae todos los productos en una respuesta. Con decenas es
  irrelevante. `ponytail:` pasar a paginación/filtro server-side por encima de ~500
  filas — ahí el payload y el filtrado en memoria empiezan a doler.
- **Superficie de autorización sin cambios**: cualquier usuario autenticado puede
  llamar `/api/admin/products`. Deuda consciente, heredada de 002 (§11). No se
  despliega a producción con datos reales antes de cerrar el RBAC.
- **Mutaciones sin traza**: sin `audit_logs`, un cambio de precio no deja rastro de
  quién lo hizo. En productos duele más que en categorías.
- **`image_url` es texto libre**: se valida como URL con Zod pero se muestra como
  enlace, no como `<img>` remota (haría falta configurar `images.remotePatterns`).

## 11. Fuera de alcance / deuda aceptada

- **`requirePermission()` y RBAC**: `src/lib/permissions.ts` sigue sin existir. CLAUDE.md
  regla 8 y SETUP.md §6 se incumplen a sabiendas, por decisión del usuario. Al cerrar el
  spec de RBAC hay que volver sobre los **diez** handlers (5 de categorías + 5 de productos).
- **`audit_logs`**: CLAUDE.md regla 9 sigue pendiente.
- **Filtros y paginación server-side**: los de categorías siguen sin consumidor; los de
  productos ni se escriben. Se resuelven juntos cuando llegue el storefront o el volumen.
- **`data-table` compartido**: se reevalúa con la tercera tabla (pedidos). Ver §8.
- **`useCategories()` sin estado de error en el `<Select>`** (review 003, MENOR): en
  `product-form-dialog.tsx` y `products-table.tsx`, si la query de categorías falla el
  selector queda vacío sin feedback. No es un AC. Fix: deshabilitar el `<Select>` con
  aviso cuando `isError`.
- **`aria-sort` en `categories-table.tsx`** (MENOR-5 del review 002): la tabla de
  productos nace con el atributo; el retrofit de la de categorías sigue pendiente.
- **`create()` miente en su tipo de retorno** (MENOR-6 del review 002): el repositorio
  de productos replica el patrón `const [row] = await ...returning()` tipado como
  `Promise<Product>`. Se corrige en ambos repos al encender `noUncheckedIndexedAccess`.
- **`/api/*` responde `307` en vez de `401` sin sesión**: sigue igual, se resuelve en
  `proxy.ts` en su propio spec.
- **Galería multi-imagen, variantes y specs técnicas**: fuera del catálogo mínimo.
- **CLAUDE.md §5 dice TanStack Table v8**: la instalada es 9.2.3. Corregir la doc sigue
  fuera del alcance de un spec de feature.
