---
id: 012
title: Carrito persistente por usuario
status: done
module: cart
scope: client
---

# 012 — Carrito persistente por usuario

## Objetivo
Un usuario logueado agrega productos al carrito, ajusta cantidades y los ve
igual tras un refresh o desde otro dispositivo.

## Alcance
Incluye:
- Tabla `cart_items` + repositorio + `GET/POST /api/cart`, `PATCH/DELETE /api/cart/[productId]`.
- Ícono de carrito con contador en el header (solo logueado) y drawer lateral (`sheet`) con ítems, +/–, quitar y subtotal.
- Botón "Agregar" en `HeroProduct` y `ProductCard`. Anónimo: el botón abre el modal de sign-in de Clerk.

No incluye:
- Checkout, `orders`, envío e impuestos. El botón "Iniciar compra" del drawer queda deshabilitado con "Próximamente" — igual que el diseño, que no lo cablea.
- Carrito anónimo en `localStorage` y su merge al loguearse: el objetivo es "persistente por usuario"; un segundo almacén + reconciliación es la parte cara y solo sirve al invitado. Si el negocio pide compra sin cuenta, entra como spec aparte.
- Optimistic updates: `invalidateQueries` tras cada mutación. El drawer es local y la latencia es de una consulta; el rollback no se paga hasta que se note.
- Favoritos y toggle de tema del diseño (siguen fuera, igual que en 010/011).
- Reserva de stock: se valida contra `products.stock` al agregar, no se bloquea.

## Criterios de aceptación
- [ ] AC1 — Dado que estoy deslogueado cuando toco "Agregar" entonces se abre el modal de sign-in y no hay llamada a `/api/cart`.
- [ ] AC2 — Dado que estoy logueado cuando toco "Agregar" entonces el ítem queda en el carrito, el drawer se abre y el badge del header muestra la suma de cantidades.
- [ ] AC3 — Dado un producto ya en el carrito cuando vuelvo a tocar "Agregar" entonces la cantidad sube a 2 y no se crea una segunda fila.
- [ ] AC4 — Dado el drawer abierto cuando uso +/– entonces la cantidad y el subtotal (`formatPrice`) se actualizan; con cantidad 1, "–" queda deshabilitado.
- [ ] AC5 — Dado que toco "Quitar" entonces la fila desaparece; sin ítems veo el estado vacío con "Seguir viendo" que cierra el drawer.
- [ ] AC6 — Dado que recargo la página o entro desde otro navegador con la misma cuenta entonces el carrito es el mismo.
- [ ] AC7 — Dado un producto con `stock` 0 entonces el botón sale deshabilitado ("Sin stock") y el endpoint responde 409 si igual se lo llama.
- [ ] AC8 — Dado `POST /api/cart` sin sesión entonces 401 JSON (no 404 HTML ni redirect).
- [ ] AC9 — Dado `productId` inexistente/inactivo o `quantity` fuera de rango entonces 404 / 400 con `error`.

## Datos
Tabla nueva `cart_items` (`src/server/db/schema/cart-item.ts`), requiere migración (`npm run db:generate`):

| columna | tipo | constraint |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | FK → `users.id` `onDelete: cascade`, notNull |
| `product_id` | uuid | FK → `products.id` `onDelete: cascade`, notNull |
| `quantity` | integer | notNull, default 1 |
| `created_at` / `updated_at` | timestamptz | notNull, `defaultNow()` / `$onUpdate` |

Índices: `uniqueIndex(user_id, product_id)` (lo usa el upsert atómico) e `index(user_id)`.
Sin tabla `carts`: sin checkout no tiene columnas propias. Sin snapshot de precio: el precio vivo sale del JOIN.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/cart` | sesión | — | `CartItem[]` |
| POST | `/api/cart` | sesión | `{ productId, quantity? }` | `CartItem[]` |
| PATCH | `/api/cart/[productId]` | sesión | `{ quantity }` | `CartItem[]` |
| DELETE | `/api/cart/[productId]` | sesión | — | `CartItem[]` |

Sin `requirePermission`: no son rutas admin, alcanza con sesión.
POST **suma** (upsert `quantity + excluded.quantity`, sin leer antes: evita el race de dos pestañas). PATCH **fija** la cantidad (el drawer ya tiene el valor en pantalla). Los tres devuelven el carrito completo para que el hook no tenga que refetchear a mano.

Zod (`src/modules/cart/schemas/cart.schema.ts`):
- `addToCartSchema`: `productId` uuid · `quantity` int 1–99 default 1.
- `setQuantitySchema`: `quantity` int 1–99 (para 0 se usa DELETE).

## Reutilizar
- `src/components/ui/sheet.tsx` — ya instalado. **No hay que instalar componentes shadcn.**
- `src/lib/permissions.ts` — `getUserByClerkId(clerkId)` (cacheado) para mapear Clerk → `users.id`.
- `src/lib/money.ts` — `formatPrice`; `src/lib/api-error.ts` — `getApiErrorMessage` en el drawer.
- `src/lib/axios.ts` — `api`; `src/modules/products/hooks/use-products.ts` — patrón `useQuery`/`useMutation` + `invalidateQueries`.
- `@clerk/nextjs` — `Show when="signed-in|signed-out"` y `SignInButton mode="modal"`, ya usados en `src/components/shared/header.tsx`.
- `src/server/repositories/product.repository.ts` — proyección con JOIN a categorías como referencia de estilo (nada de N+1).
- `src/app/(storefront)/layout.tsx` — monta `<Header />`; el drawer se monta acá una sola vez.

## Tareas
- [x] T1 — Schema `cartItems` + tipos inferidos, exportar en `schema/index.ts` · `src/server/db/schema/cart-item.ts`
- [x] T2 — Migración: `npm run db:generate` (aplicar queda para el usuario) · `drizzle/`
- [x] T3 — Guard `requireSessionUser()` (401 JSON sin sesión, 401 si `users` aún no espejó al usuario), misma unión discriminada que `Guard` · `src/lib/auth.ts`
- [x] T4 — Sacar `/api/cart(.*)` del `auth.protect()` del borde: agregarlo al matcher de API JSON junto a `/api/admin(.*)` · `src/proxy.ts`
- [x] T5 — Schemas Zod y tipo `CartItem` · `src/modules/cart/schemas/cart.schema.ts`, `src/modules/cart/types/cart.ts`
- [x] T6 — Repositorio: `listByUser` (JOIN productos activos), `addItem` (upsert atómico), `setQuantity`, `removeItem` · `src/server/repositories/cart.repository.ts`
- [x] T7 — Handlers `GET`/`POST` con validación de producto activo y `stock` · `src/app/api/cart/route.ts`
- [x] T8 — Handlers `PATCH`/`DELETE` (`await params`) · `src/app/api/cart/[productId]/route.ts`
- [x] T9 — Service axios · `src/modules/cart/services/cart.service.ts`
- [x] T10 — Hooks `useCart` / `useAddToCart` / `useSetCartQuantity` / `useRemoveFromCart` · `src/modules/cart/hooks/use-cart.ts`
- [x] T11 — Store Zustand solo abierto/cerrado del drawer · `src/modules/cart/store/cart-drawer.store.ts`
- [x] T12 — `<AddToCartButton productId stock />` (client): deslogueado → `SignInButton`; logueado → mutate + abrir drawer · `src/modules/cart/components/add-to-cart-button.tsx`
- [x] T13 — `<CartDrawer />` con `Sheet`: lista, +/–, quitar, subtotal, vacío, carga y error · `src/modules/cart/components/cart-drawer.tsx`
- [x] T14 — `<CartButton />` (client): ícono + badge con la suma de cantidades, dentro de `Show when="signed-in"` · `src/modules/cart/components/cart-button.tsx`
- [x] T15 — Montar `<CartButton />` en el header y `<CartDrawer />` en el layout storefront · `src/components/shared/header.tsx`, `src/app/(storefront)/layout.tsx`
- [x] T16 — Botón "Agregar" en el hero, al lado de "Ver producto" · `src/modules/products/components/hero-product.tsx`
- [x] T17 — Botón "Agregar" en la card: el `<Link>` deja de envolver la card entera y el botón queda como hermano · `src/modules/products/components/product-card.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- `ProductCard` hoy es un `<Link>` que envuelve todo: un `<button>` adentro de un `<a>` es HTML inválido y rompe el teclado. Por eso T17 reestructura en vez de solo insertar.
- El header es Server Component: `CartButton` es la única isla `"use client"` que entra ahí; `Show` de Clerk evita que un anónimo dispare `GET /api/cart`.
- `users` se llena por el webhook de Clerk (spec 005). Si un usuario recién creado no está espejado, `getUserByClerkId` devuelve `null`: T3 corta con 401, no crea la fila al vuelo.
- El proxy hoy protege `/api/cart` con `auth.protect()`, que responde 404 HTML — contradice AC8. De ahí T4.
- Subtotal calculado en el cliente sumando `price * quantity` sobre los ítems ya cargados; centavos enteros, sin float.
- Review 1 (hallazgo MAYOR): el `mutate` de `AddToCartButton` no daba feedback de error. Se resolvió con `toast.error(getApiErrorMessage(...))` en `onError` y `<Toaster />` montado en el layout storefront (mismo componente `ui/sonner` que ya usa el admin). Se descartó el mensaje inline porque el botón está posicionado `absolute` sobre la card y desplazaría el layout.
