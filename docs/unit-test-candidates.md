# Funciones candidatas a pruebas unitarias

Inventario de funciones puras (sin UI, sin flujo entre componentes, sin I/O a
BD/Clerk/Stripe) aptas para `node --test`. Se excluyen a propósito: componentes,
hooks, stores, repositorios (Drizzle/DB), servicios que llaman axios/Stripe sin
lógica propia, y schemas Zod (son objetos, no funciones).

---

## Núcleo compartido (`src/lib`)

### Dinero

| Función | Archivo | Qué hace |
|---|---|---|
| `toCents` | `src/lib/money.ts` | Convierte soles (decimal) a céntimos enteros redondeando. |
| `fromCents` | `src/lib/money.ts` | Convierte céntimos enteros a soles (decimal). |
| `formatPrice` | `src/lib/money.ts` | Formatea céntimos como moneda `es-PE` (`S/ 19.99`). |

### RBAC / Permisos

| Función | Archivo | Qué hace |
|---|---|---|
| `can` | `src/lib/permissions.ts` | Indica si un set de permisos contiene un código dado. |
| `assignableRoles` | `src/lib/rbac-catalog.ts` | Filtra los roles asignables desde el panel según si el actor puede asignar administradores. |
| `permissionCodesForRole` | `src/lib/rbac-catalog.ts` | Devuelve los códigos de permiso de un rol (`"*"` se expande a todo el catálogo). |

### Identificadores y texto

| Función | Archivo | Qué hace |
|---|---|---|
| `slugify` | `src/lib/slug.ts` | Normaliza un texto a slug (sin diacríticos, minúsculas, guiones). |
| `cn` | `src/lib/utils.ts` | Combina clases de Tailwind resolviendo conflictos (`clsx` + `twMerge`). |

### Seguridad

| Función | Archivo | Qué hace |
|---|---|---|
| `generateTemporaryPassword` | `src/lib/password.ts` | Genera una contraseña temporal de 16 caracteres con las 4 clases garantizadas y orden aleatorio (Fisher-Yates). |
| `stripSensitive` | `src/lib/audit.ts` | Redacta recursivamente claves sensibles (password, token, pin, etc.) de un objeto antes de auditarlo. |

### Errores

| Función | Archivo | Qué hace |
|---|---|---|
| `isUniqueViolation` | `src/lib/db-errors.ts` | Indica si un error de Postgres es una violación de unicidad (código `23505`). |
| `isForeignKeyViolation` | `src/lib/db-errors.ts` | Indica si un error de Postgres es una violación referencial (`23503`/`23001`). |
| `violatedConstraint` | `src/lib/db-errors.ts` | Extrae el nombre del constraint violado de un error de Postgres. |
| `getApiErrorMessage` | `src/lib/api-error.ts` | Extrae el mensaje de error de una respuesta axios, con fallback si no es un `AxiosError`. |
| `isConflict` | `src/lib/api-error.ts` | Indica si un error axios corresponde a un 409. |

### Bordes cubiertos (ampliación)

- `money`: negativos (`-19.99` → `-1999`), `0.1 + 0.2` → 30, `formatPrice` de 1 céntimo y agrupación de miles (con NBSP). **BUG abierto** (test `todo`): `toCents(1.005)` da 100 y `toCents(0.285)` da 28 — `Math.round` sobre el producto flotante redondea medio céntimo hacia abajo; el schema del formulario admite más de 2 decimales (solo el `step="0.01"` del input lo frena).
- `slugify`: dígitos, solo símbolos → `""`, `_` y `.` → guion.
- `generateTemporaryPassword`: garantía de las 4 clases y alfabeto permitido en 500 generaciones (una muestra sola no prueba una garantía).
- `stripSensitive`: primitivos/`null`, arrays en la raíz y anidados, clave sensible con valor objeto, variantes `api_key`/`API-KEY`/`privateKey`/`Authorization`/`sessionId`/`cookie`, segmentos cortos en camelCase/snake_case (`userPin`, `card_cvv`, `PIN_CODE`), falsos positivos (`pinned`, `spinner`) y no mutación del original.
- `db-errors`: `code` no string, `null`/`undefined`/string como error, precedencia del código de primer nivel sobre `cause`, FK y constraint leídos desde `cause`, constraint no string.
- `api-error`: error axios sin `response` (red) y sin `data.error`; `isConflict` sin `response`.
- `assignableRoles`: conserva el orden de `ROLES`.

### Sin probar en `src/lib` (y por qué)

- `auth.ts`, `permissions.ts`, `clerk-sync.ts`: importan Clerk y repositorios → `@/server/db` lanza sin `DATABASE_URL`. La lógica pura (`can`, catálogo) ya vive en `rbac-catalog.ts`. Candidato menor a extraer: `auditMetadata` (no exportado, `clerk-sync.ts`).
- `stripe.ts`: lanza al importar sin `STRIPE_SECRET_KEY`; solo instancia el cliente.
- `axios.ts`, `query-client.ts`: configuración sin ramas; un test sería trivial.

---

## Servicios de servidor (`src/server/services`)

Sin tests: `checkout.service.ts` y `payment-method.service.ts` importan `@/lib/stripe` (lanza sin `STRIPE_SECRET_KEY`) y repositorios (`@/server/db` lanza sin `DATABASE_URL`), y leen `NEXT_PUBLIC_APP_URL` al evaluarse. Probarlos exigiría mocks o env vars, así que no se agregaron `export`. Candidatos a extraer a `src/lib/` (p. ej. `lib/checkout.ts`) para hacerlos probables:

| Helper | Archivo | Qué hace |
|---|---|---|
| `absoluteImage` | `checkout.service.ts` | Resuelve la imagen contra `APP_URL` y solo la manda si es `https://` (recibir `appUrl` por parámetro). |
| `toCustomerParams` | `checkout.service.ts` | `customer` + filtros de redisplay si hay `stripeCustomerId`, si no `customer_email` (excluyentes). |
| `toLineItem` | `checkout.service.ts` | `CartItem` → line item de Stripe en céntimos (`unit_amount = price`, `currency: "pen"`). |
| validación de stock | `checkout.service.ts` (inline) | Carrito vacío → 400; primer ítem con `stock < quantity` → 409 con su nombre. |
| nombre del Customer | `payment-method.service.ts` (inline) | `[firstName, lastName].filter(Boolean).join(" ") \|\| undefined`. |
| id del SetupIntent | `payment-method.service.ts` (inline) | `setup_intent` como string u objeto expandido → id. |

---

## Módulo Auditoría (`src/modules/audit`)

### Etiquetas y descripciones

| Función | Archivo | Qué hace |
|---|---|---|
| `actionLabel` | `src/modules/audit/lib/audit-labels.ts` | Traduce el código de acción de un log (`"user.created"`) a texto en español. |
| `entityLabel` | `src/modules/audit/lib/audit-labels.ts` | Traduce el tipo de entidad de un log (`"user"`) a texto en español. |
| `describeChange` | `src/modules/audit/lib/audit-labels.ts` | Arma la frase legible de un registro de auditoría según su acción y metadata. |

### Paginación por cursor

| Función | Archivo | Qué hace |
|---|---|---|
| `parseCursor` | `src/modules/audit/lib/cursor.ts` | Parsea el cursor `"<fecha ISO>\|<uuid>"` y valida formato y existencia de la fecha. |

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `auditSeveritySchema` | `src/modules/audit/schemas/audit-log.schema.ts` | Severidad del log: solo `info`, `warning` o `error`. |
| `listAuditLogsQuerySchema` | `src/modules/audit/schemas/audit-log.schema.ts` | Query de `GET /api/admin/audit-logs`: `action`/`entityType` recortados con máximo 64/32, `actorId` `"system"` o uuid, `from`/`to` `YYYY-MM-DD`, `limit` coercionado 1–100 (default 50) y `cursor` transformado vía `parseCursor` (issue "Cursor inválido" en vez de throw). |

---

## Módulo Clientes (`src/modules/customers`)

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `paymentMethodIdParamSchema` | `src/modules/customers/schemas/payment-method.schema.ts` | Param de `DELETE /api/payment-methods/[id]`: `id` uuid (id interno, no el `pm_…` de Stripe), sin trim ni coerción; claves extra se descartan. |

Sin funciones puras exportadas: `services/` son wrappers axios, `hooks/` son TanStack Query, `types/` solo reexporta `PaymentMethod` y `store/` está vacío. Candidato menor: `cardLabel` (`brand •••• last4`) vive no exportado en `components/payment-methods-section.tsx`; es una plantilla sin ramas.

---

## Módulo Productos (`src/modules/products`)

| Función | Archivo | Qué hace |
|---|---|---|
| `catalogHref` | `src/modules/products/lib/catalog-href.ts` | Construye la URL del catálogo con los filtros de categoría/búsqueda/orden y página, omitiendo valores por defecto. |
| `toPayload` | `src/modules/products/services/product.service.ts` | Convierte los valores del formulario (soles) al payload de la API: `price`/`compareAtPrice` a céntimos vía `toCents`, conservando `null`/`undefined`. Exportado solo para probarlo. |

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `createProductSchema` | `src/modules/products/schemas/product.schema.ts` | Body de `POST /api/admin/products`: `name` recortado 2–120, `slug` opcional recortado 2–120 kebab-case, `description` nullish ≤2000, `categoryId` uuid, `price` entero en céntimos 0–100 000 000 sin coerción, `compareAtPrice` nullish con las mismas reglas y refine estrictamente mayor que `price` (issue en `compareAtPrice`), `sku` nullish recortado 2–60, `stock` entero ≥0, `imageUrl` nullish URL, booleanos sin coerción; claves extra se descartan. |
| `updateProductSchema` | `src/modules/products/schemas/product.schema.ts` | Body de `PATCH`: parcial del de creación con refine "Nada para actualizar" y comparación de `compareAtPrice` solo si llega `price`. |
| `productFormSchema` | `src/modules/products/schemas/product.schema.ts` | Formulario admin: mismos campos pero `price`/`compareAtPrice` en soles con decimales 0–1 000 000 ("Ingresá un precio válido" ante NaN/string) y el mismo refine. |
| `productIdSchema` | `src/modules/products/schemas/product.schema.ts` | Id de producto como uuid, con mensaje "Identificador inválido". |
| `publicProductQuerySchema` | `src/modules/products/schemas/product.schema.ts` | Query de `GET /api/products`: `featured` vía `stringbool` (`"false"` → false), `category` recortada kebab-case, `search` recortado ≤80, `sort` enum con default `relevance`, `limit` coercionado entero 1–48 (default 12, `""` falla) y `page` coercionado con `.catch(1)` ante basura sin romper el resto. |

Sin probar (y por qué): `useFavorites` (store Zustand con `persist`/`localStorage`, el `toggle` no es una función suelta), hooks TanStack Query y wrappers axios del service. Candidatos atrapados en componentes: `pageWindow` (exportado, con ramas de elipsis) vive en `components/catalog-pagination.tsx` que importa `next/link` y shadcn — moverlo a `lib/` lo haría probable; `toDefaults` y `optionalNumber` en `components/product-form-dialog.tsx` (no exportados). La función `compareAtIsHigher` de los schemas queda cubierta vía los refines.

---

## Módulo Carrito (`src/modules/cart`)

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `productIdSchema` | `src/modules/cart/schemas/cart.schema.ts` | `productId` como uuid, con mensaje "Producto inválido". |
| `addToCartSchema` | `src/modules/cart/schemas/cart.schema.ts` | Body de `POST /api/cart`: `productId` uuid y `quantity` entero 1–`MAX_QUANTITY` (99), default 1, sin coerción de strings. |
| `setQuantitySchema` | `src/modules/cart/schemas/cart.schema.ts` | Body de `PATCH /api/cart/[productId]`: `quantity` entero 1–99 obligatorio (0 no: quitar va por `DELETE`). |

Candidato sin cubrir: el cálculo de subtotal (`Σ price × quantity` en céntimos) vive inline en `CartDrawer` (`components/cart-drawer.tsx`); extraerlo a `lib/` lo haría probable.

---

## Módulo Categorías (`src/modules/categories`)

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `createCategorySchema` | `src/modules/categories/schemas/category.schema.ts` | Body de `POST /api/admin/categories`: `name` recortado 2–80, `slug` opcional recortado 2–80 en kebab-case (`Slug inválido`), `description` nullish recortada ≤500, `imageUrl` nullish URL válida, `isActive` boolean sin coerción, `position` entero ≥0 sin coerción. |
| `updateCategorySchema` | `src/modules/categories/schemas/category.schema.ts` | Body de `PATCH`: parcial del de creación con refine "Nada para actualizar" si no llega ningún campo conocido (las claves desconocidas se descartan). |
| `listCategoriesQuerySchema` | `src/modules/categories/schemas/category.schema.ts` | Query de listado: `search` recortado ≤80 y `active` solo `"true"`/`"false"`. |
| `categoryIdSchema` | `src/modules/categories/schemas/category.schema.ts` | Id de categoría como uuid, con mensaje "Identificador inválido". |

Sin funciones puras en el módulo: `services/` son wrappers axios y `store/` está vacío. Candidato menor: `toDefaults` (mapeo `Category` → valores del formulario) vive no exportado en `components/category-form-dialog.tsx`.

---

## Módulo Checkout (`src/modules/checkout`)

Sin funciones puras ni schemas: el módulo solo tiene `services/checkout.service.ts`
(`startCheckout`, wrapper axios de `POST /api/checkout`) y `hooks/use-checkout.ts`
(mutación TanStack Query con redirección y toast). `POST /api/checkout` no recibe
body, así que no hay schema Zod de checkout. Los helpers puros del flujo viven en
`src/server/services/checkout.service.ts` (se cubren con `src/server/services`).
Candidato menor: el mapa `STATUS_COPY` (`OrderStatus` → textos) está inline en
`src/app/(storefront)/checkout/success/page.tsx` y mezcla JSX; no es lógica con ramas.

---

## Módulo Dashboard (`src/modules/dashboard`)

Sin funciones puras ni schemas: el módulo aún no está implementado (solo
`.gitkeep` en `components/`, `hooks/`, `schemas/`, `services/`, `store/` y
`types/`, y no existe `src/app/(admin)/admin/dashboard`). Las únicas menciones a
"dashboard" en `src/` son el código de permiso `dashboard.view` del catálogo RBAC.
Cuando se construya, candidatos típicos: agregación de KPIs en céntimos,
variación porcentual (con guarda de división por cero), rellenado de días sin
ventas y rangos de fechas recibidos por parámetro.

---

## Módulo Órdenes (`src/modules/orders`)

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `orderRangeQuerySchema` | `src/modules/orders/schemas/order.schema.ts` | Query de `GET /api/orders`: `from`/`to` opcionales `YYYY-MM-DD` (fechas reales del calendario), sin defaults; refine «Desde» ≤ «hasta» con issue en `from`; `tzOffset` coercionado entero −840…840 (`""` → 0). |
| `orderIdSchema` | `src/modules/orders/schemas/order.schema.ts` | Id de orden como uuid (param de `GET /api/orders/[id]/receipt`). |

Sin funciones puras exportadas probables sin mocks: `services/` son wrappers axios, `hooks/use-orders.ts` es TanStack Query (`ordersKey` es una tupla trivial en un archivo `"use client"`), `types/` solo reexporta tipos y `store/` está vacío. Candidatos atrapados en componentes (no exportados): `groupByDay` y `currentMonthRange`/`toDateInput` en `components/purchases-section.tsx` (agrupan por día con `Intl` y dependen de la hora local), y el mapa `STATUS_LABEL` en `components/order-detail-dialog.tsx`. `startOfDay` (offset horario → `Date`) vive no exportado en `src/app/api/orders/route.ts`.

---

## Módulo Roles (`src/modules/roles`)

| Función | Archivo | Qué hace |
|---|---|---|
| `resourceLabel` | `src/modules/roles/lib/permission-groups.ts` | Traduce un recurso técnico (`"products"`) a su nombre de negocio (`"Productos"`). |
| `actionLabel` | `src/modules/roles/lib/permission-groups.ts` | Traduce una acción técnica (`"update_status"`) a verbo de negocio (`"cambiar estado"`). |
| `groupByResource` | `src/modules/roles/lib/permission-groups.ts` | Agrupa una lista de permisos por recurso, conservando el orden de entrada. |

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `permissionCodeSchema` | `src/modules/roles/schemas/role.schema.ts` | Enum cerrado con los códigos de `PERMISSIONS`: rechaza `"*"`, códigos fuera del catálogo con formato válido, espacios/mayúsculas (sin trim) y no-strings. |
| `updateRolePermissionsSchema` | `src/modules/roles/schemas/role.schema.ts` | Body de `PATCH /api/admin/roles/[id]`: `permissionCodes` array obligatorio de `permissionCodeSchema`; acepta `[]` (revocar todo) y duplicados (los deduplica el handler); un código inválido invalida la lista con path al índice; claves extra (`slug`, `roleId`) se descartan. |
| `roleIdSchema` | `src/modules/roles/schemas/role.schema.ts` | Id de puesto como uuid con mensaje "Identificador inválido" (un slug como `super_admin` no pasa). |

Sin probar (y por qué): `services/role.service.ts` son wrappers axios, `hooks/use-roles.ts` es TanStack Query, `types/` solo tipos y `store/` vacío. El bloqueo de edición del Dueño (`role.slug === "super_admin"` → 409) y la resincronización con Clerk viven en el route handler y requieren DB/Clerk: no son unitarios.

---

## Módulo Usuarios (`src/modules/users`)

### Schemas

| Schema | Archivo | Qué valida |
|---|---|---|
| `roleSlugSchema` | `src/modules/users/schemas/user.schema.ts` | Enum cerrado con los slugs de `ROLES`: rechaza slugs inventados, nombres visibles (`"Dueño"`), `"*"`, espacios/mayúsculas (sin trim) y no-strings. |
| `createUserSchema` | `src/modules/users/schemas/user.schema.ts` | Body de `POST /api/admin/users`: `email` obligatorio con formato válido (sin trim ni lowercase, "Email inválido"), `firstName`/`lastName` opcionales recortados ≤80 (se cuenta tras el trim; `"   "` → `""`), `roleSlug` único del catálogo; claves extra (`password`, `roleSlugs`, `clerkId`, `isActive`) se descartan. |
| `updateUserSchema` | `src/modules/users/schemas/user.schema.ts` | Body de `PATCH /api/admin/users/[id]`: perfil recortado ≤80 y/o `roleSlugs` array del catálogo (acepta `[]` y duplicados; path al índice inválido); refine "Nada para actualizar" si no llega ningún campo conocido; `email`/`isActive` se descartan. |
| `assignRolesSchema` | `src/modules/users/schemas/user.schema.ts` | Formulario del diálogo de puestos: `roleSlugs` array obligatorio del catálogo (acepta `[]`). |
| `userIdSchema` | `src/modules/users/schemas/user.schema.ts` | Id de persona como uuid con "Identificador inválido" (un `clerkId` o email no pasan). |
| `listUsersQuerySchema` | `src/modules/users/schemas/user.schema.ts` | Query de `GET /api/admin/users`: `search` recortado ≤80, `active` solo `"true"`/`"false"` sin coerción, sin defaults; parámetros desconocidos se descartan. |

Sin funciones puras exportadas: `services/user.service.ts` son wrappers axios, `hooks/use-users.ts` es TanStack Query y `types/user.ts` solo tipos. Observaciones de seguridad (no bugs): `roleSlugSchema` acepta `super_admin`/`admin`/`customer`; la escalada a admin la frenan los handlers con `users.assign_admin`, pero `customer` (que `assignableRoles` excluye del panel) no se rechaza en el servidor. Además, desde JS un objeto `{ firstName: undefined }` pasa el refine "Nada para actualizar" (no alcanzable vía JSON). El cálculo de `toAssign`/`toRevoke`/`touchesAdmin` vive inline en `src/app/api/admin/users/[id]/route.ts`: extraerlo a `lib/` lo haría probable.

---

## Fuera de este inventario (y por qué)

- **`src/server/repositories/*`**: solo arman queries Drizzle contra `db`; probarlas es integración, no unidad.
- **`src/server/services/*` y `src/lib/{auth,clerk-sync,stripe,axios}.ts`**: orquestan DB/Clerk/Stripe; sin mocks pesados no son unitarias (ver candidatos a extraer arriba).
- **`src/modules/*/services/*`**: wrappers de `axios` sin lógica propia (los pocos helpers internos como `toPayload` no están exportados).
- **Schemas Zod (`*.schema.ts`)**: son objetos de validación, no funciones; se prueban con `.safeParse()` si se decide cubrirlos, pero no aplican al formato de este documento.
