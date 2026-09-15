---
id: 017
title: Stripe Checkout — órdenes y creación de la sesión
status: done
module: orders
scope: client
---

# 017 — Stripe Checkout: órdenes y creación de la sesión

Traduce `docs/stripe/stripe-checkout.md` §1–§5, §7, P0–P5, P8–P9. Ese doc manda:
acá no se repiten sus justificaciones.

## Objetivo
Un usuario logueado toca "Iniciar compra" en el carrito y termina pagando en la
página hosted de Stripe, con su pedido guardado en `pending` en nuestra base.

## Alcance
Incluye:
- Tablas `orders` + `order_items` (§3) + migración.
- `src/lib/stripe.ts`, `order.repository`, `checkout.service` (servidor), `POST /api/checkout`.
- Capa cliente `src/modules/checkout/` + botón del `CartDrawer` cableado.
- Páginas `/checkout/success` y `/checkout/cancel` (solo leen y muestran).

No incluye:
- **Webhook y fulfillment** (spec 018): acá nadie descuenta stock, vacía el carrito ni marca `paid`.
- Envío, impuestos (`automatic_tax` apagado), cupones, invitado, admin de pedidos, reembolsos.
- Sincronizar el catálogo con Stripe (`price_data` en línea, §1).
- `payment_method_types`: prohibido pasarlo (§7).

## Criterios de aceptación
Recorridos y validados por el usuario el 2026-09-07 (AC6: la pantalla "confirmando pago" con la order en `pending` es el comportamiento esperado sin el webhook de la 018).

- [x] AC1 — Dado un carrito con ítems cuando toco "Iniciar compra" entonces el navegador va a `checkout.stripe.com` y queda una `order` `pending` con sus `order_items` (nombre y precio congelados) y una fila `order.created` en `audit_logs`.
- [x] AC2 — Dado el carrito vacío entonces el botón está deshabilitado y `POST /api/checkout` responde 400.
- [x] AC3 — Dado que un ítem del carrito quedó sin stock entre agregar y pagar entonces la respuesta es 409, se ve un `toast.error` y el carrito se refresca.
  > Enmendado tras review 1: se descartó el 409 por **cambio de precio**. `cart_items` no guarda snapshot de precio (decisión del spec 012) y el drawer muestra siempre el precio vivo, así que no existe un precio "aceptado" distinto del que se cobra; `order_items` congela el precio vivo al crear la order. La detección de precio solo tendría sentido con snapshot en el carrito o un total esperado enviado desde el cliente — fuera de alcance, entra como spec propio si el negocio lo pide.
  > Aclarado tras review 2: **producto desactivado ≠ 409**. `listByUser` filtra `isActive = true`, así que un ítem desactivado entre agregar y pagar simplemente desaparece de la revalidación (misma vista que ya muestra el drawer). Si quedan otros ítems, la compra sigue con esos; si no queda ninguno, es 400 "carrito vacío". Un 409 explícito "un producto ya no está disponible" necesita comparar contra `listByUser` sin filtro — mismo destino que el 409 por precio: spec propio si se pide.
- [x] AC4 — Dado `POST /api/checkout` sin sesión entonces 401 JSON (no 404 HTML ni redirect).
- [x] AC5 — Dado que toco el botón dos veces seguidas entonces se crea una sola Checkout Session (idempotencyKey = `orderId`).
- [x] AC6 — Dado que pago con `4242 4242 4242 4242` entonces vuelvo a `/checkout/success?session_id=...` y veo el resumen del pedido; sin el webhook la order sigue `pending`, el stock no bajó y el carrito no se vació.
- [x] AC7 — Dado que cancelo en la página de Stripe entonces vuelvo a `/checkout/cancel` con link al carrito y la order queda `pending`.
- [x] AC8 — Dado un `session_id` inexistente, ausente o de otro usuario en `/checkout/success` entonces se ve "no encontramos ese pedido", nunca datos ajenos ni un 500.

## Datos
Dos tablas nuevas, **requieren migración** (`npm run db:generate`).

`orders` · `src/server/db/schema/order.ts`

| columna | tipo | constraint |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | FK → `users.id` `onDelete: restrict`, notNull |
| `status` | `pgEnum("order_status")` | `pending`\|`paid`\|`failed`\|`expired`\|`fulfilled`, notNull, default `pending` |
| `currency` | text | notNull, default `pen` |
| `total_amount` | integer | notNull, centavos |
| `stripe_checkout_session_id` | text | nullable (se llena tras crear la sesión) |
| `stripe_payment_intent_id` | text | nullable (lo llena 018) |
| `created_at` / `updated_at` | timestamptz | notNull, `defaultNow()` / `$onUpdate` |

Índices: `uniqueIndex(stripe_checkout_session_id)`, `index(user_id, created_at desc)`, `index(status)`.

`order_items` · `src/server/db/schema/order-item.ts`: `id` uuid PK · `order_id` FK → `orders.id` `onDelete: cascade` notNull · `product_id` FK → `products.id` `onDelete: restrict` notNull · `name` text notNull · `unit_price` integer notNull · `quantity` integer notNull. `name`/`unit_price` son snapshot.

Tipos con `InferSelectModel`, nunca a mano. Exportar ambos en `schema/index.ts`.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/checkout` | sesión (`requireSessionUser`) | — | 200 `{ url }` · 400 carrito vacío · 409 `{ error }` precio/stock cambió · 401 · 500 |

**Sin Zod**: el handler no recibe body (el carrito vive en el servidor). El
service devuelve una unión discriminada `{ ok: true; url } | { ok: false; status; error }`
y el handler la traduce; nada de clases de error nuevas.

## Reutilizar
- `src/lib/auth.ts` — `requireSessionUser()` (401 JSON, `user` con `id` y `email`).
- `src/server/repositories/cart.repository.ts` — `listByUser()` ya devuelve `price` y `stock` vivos con JOIN: es la revalidación, no hace falta otra consulta.
- `src/lib/audit.ts` — `logAudit(tx, entry)`; `src/server/db/index.ts` — `db`, tipo `Tx`.
- `src/lib/axios.ts` — `api`; `src/lib/api-error.ts` — `getApiErrorMessage`; `src/lib/money.ts` — `formatPrice`.
- `src/modules/cart/hooks/use-cart.ts` — `cartKey` para invalidar en el 409.
- `src/app/api/cart/route.ts` — patrón de handler (guard → try/catch → `console.error` + JSON).
- `src/modules/cart/components/add-to-cart-button.tsx` — patrón `toast.error` en `onError`.
- `sonner` (`<Toaster />` ya montado en el layout storefront) y `src/components/ui/*`: **no hay que instalar componentes shadcn**.
- `NEXT_PUBLIC_APP_URL` y `STRIPE_SECRET_KEY` ya están en `.env.local`/`.env.example`.

## Tareas
- [x] T1 — `npm i stripe` · `package.json`
- [x] T2 — Schema `orders` + enum `order_status` · `src/server/db/schema/order.ts`
- [x] T3 — Schema `order_items` + exports · `src/server/db/schema/order-item.ts`, `schema/index.ts`
- [x] T4 — `npm run db:generate` (aplicar la migración queda para el usuario) · `drizzle/`
- [x] T5 — Instancia única de Stripe, `apiVersion: "2026-08-26.dahlia"` · `src/lib/stripe.ts`
- [x] T6 — Repo: `createPendingOrder(userId, items)` en una tx (order + items + `audit_log` `order.created`), `attachSession`, `getBySessionId` (con ítems) · `src/server/repositories/order.repository.ts`
- [x] T7 — Service servidor `createCheckoutSession(user)`: carrito vacío → 400; ítem sin stock → 409; `line_items` con `price_data` (`currency: "pen"`, `unit_amount = price`); sesión con los parámetros de §7 e `idempotencyKey: orderId`; `attachSession` · `src/server/services/checkout.service.ts`
- [x] T8 — Handler `POST` que traduce la unión del service · `src/app/api/checkout/route.ts`
- [x] T9 — Agregar `/api/checkout` al matcher `isJsonApi` · `src/proxy.ts`
- [x] T10 — Service axios `startCheckout()` · `src/modules/checkout/services/checkout.service.ts`
- [x] T11 — Hook `useCheckout`: `useMutation`, `onSuccess` → `window.location.href = data.url`, `onError` → `toast.error` + invalidar `cartKey` si es 409 · `src/modules/checkout/hooks/use-checkout.ts`
- [x] T12 — Cablear el botón: `disabled` con carrito vacío o `isPending`, texto "Redirigiendo…" · `src/modules/cart/components/cart-drawer.tsx`
- [x] T13 — Página de éxito (Server Component): lee `session_id`, `getBySessionId`, **verifica que la order sea del usuario logueado**, muestra resumen y estado · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T14 — Página de cancelación: mensaje + link al catálogo · `src/app/(storefront)/checkout/cancel/page.tsx`
- [x] T15 — Etiquetas de bitácora `order.created` y entidad `order` · `src/modules/audit/lib/audit-labels.ts`
- [x] T16 — (review 1, MENOR) Buffer en `expires_at`: `31 * 60` en vez de `30 * 60`; con latencia de red el valor exacto puede caer bajo el mínimo de 30 min y Stripe rechaza la sesión con 400 · `src/server/services/checkout.service.ts`
- [x] T17 — (review 1, MENOR) Página de cancelación: botón con texto visible "Ver carrito" que abra el drawer (AC7), en vez del `CartButton` icon-only suelto · `src/app/(storefront)/checkout/cancel/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- El `total_amount` se calcula con los datos vivos que ya trajo `listByUser`; nada de un segundo SELECT ni de `float`.
- `getBySessionId` la comparten esta spec y la 018: firma estable, devuelve la order con sus ítems o `null`.
- `integration_identifier` (§7) solo si el SDK lo tipa; si `stripe@22` no lo declara, se omite antes que meter un `as any`.
- La página de éxito es la única que puede quedar "mintiendo" (`pending` recién pagado) hasta que exista el webhook de la 018: el copy debe decir "estamos confirmando tu pago".

## Review 1 — resultado

RECHAZADO → resuelto por decisión humana, no por otra vuelta larga de developer.

- **Bloqueante build**: `npm run build` falla con `STRIPE_SECRET_KEY` vacía (`src/lib/stripe.ts` tira al importar, mismo patrón que `src/server/db/index.ts`). No es código: se resuelve cargando la restricted key en `.env.local` (Fase 0). Verificado que con cualquier valor no vacío compilan las 30 rutas.
- **Bloqueante AC3**: contradicción spec ↔ arquitectura. Resuelto enmendando AC3 a solo-stock (ver arriba).
- **MENOR aceptados como T16/T17.** `attachSession` fuera de transacción: se deja para la 018 (es donde `getBySessionId` lo consume). `idempotencyKey` no deduplica dos POST distintos (cada uno crea su order): el doble-click lo corta el botón `disabled`; coincide con el texto del spec, sin cambio.

## Review 2 — APROBADO

`typecheck` ✓ · `lint` ✓ · `build` ✓ (30 rutas). T16/T17 verificados. Sin código muerto por la enmienda de AC3.

## Security review — APROBADO (sin bloqueantes)

Verificado OK: `STRIPE_SECRET_KEY` solo en `src/lib/stripe.ts` (server-only, no `NEXT_PUBLIC_`, `.env.local` gitignored) · IDOR en `/checkout/success` cubierto (`order.userId !== current.user.id` → mismo mensaje que "no existe") · `requireSessionUser` (401 JSON) antes de datos · importe no tampereable (precio vivo del server, sin body; `order_items` congela; Stripe cobra los mismos `line_items`) · `audit_logs.metadata` sin PII/tarjeta/secretos, en la misma tx · `session_id` con guard de tipo + query parametrizada, sin SQLi ni open redirect · error 500 genérico sin filtrar stack.

Hallazgos (no bloquean 017):
- **[BAJO] `/api/checkout` sin reutilización de order `pending` ni rate-limit.** Un usuario autenticado puede inflar `orders` y generar sesiones en Stripe con POST repetidos (el botón `disabled` solo frena el doble-click humano). Sin pérdida financiera. Mitigación: reutilizar la última order `pending` si el carrito no cambió, o rate-limit — encaja con el job de limpieza de `pending` viejas ya listado como pendiente. Candidato a spec propio.
- **[→018] `attachSession` fuera de tx sin reintento:** si falla, la order queda sin `session_id` y el webhook no la encuentra. El spec 018 debe tener fallback por `metadata.orderId`, no solo por `session_id`.
- **[INFO] Sin CSRF token en `POST /api/checkout`:** cookie-auth Clerk, sin body, efecto = una order `pending` + sesión (sin cargo). Impacto bajo, aceptable para esta acción.
