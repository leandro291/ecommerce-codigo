---
id: 019
title: Mis compras en el perfil
status: done
module: orders
scope: client
---

# 019 — Mis compras en el perfil

Llena la sección que la spec 016 dejó en vacío estático. Depende de 017/018
(`orders`, `order_items`, `stripe_payment_intent_id` ya poblado por el webhook).

## Objetivo
Un cliente ve en `/profile` sus compras agrupadas por día, filtra por mes actual
o rango custom, y abre el detalle con la boleta de Stripe.

## Alcance
Incluye:
- `GET /api/orders` con rango de fechas y `GET /api/orders/:id/receipt`.
- Sección cliente con filtro, agrupación por día y Dialog de detalle + boleta.

No incluye:
- Página `/orders` propia, paginación, cancelar/reembolsar, reordenar.
- Órdenes `pending`/`failed`/`expired`: no son compras, no se listan.
- Guardar la URL de la boleta en base: se pide a Stripe al abrir el Dialog.
- PDF de factura (`invoice_creation`): ver Notas.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario con órdenes `fulfilled` de este mes, cuando entra a `/profile`, entonces "Mis compras" muestra grupos con encabezado de fecha (día, mes y año en es-AR) y dentro de cada uno sus compras con total formateado.
- [x] AC2 — Dado el filtro en "Mes actual" (por defecto), cuando cambia a "Rango custom" y elige `desde`/`hasta`, entonces la lista se refetchea con ese rango; `desde > hasta` no dispara consulta y muestra el error inline.
- [ ] AC3 — Dado un rango sin compras, entonces se ve el estado vacío con el CTA "Ver catálogo"; mientras carga, skeleton; si falla, mensaje de error con reintento.
- [ ] AC4 — Dado que abre el detalle de una compra, entonces el Dialog lista sus ítems (nombre, cantidad, precio unitario snapshot, subtotal), el total y el estado.
- [ ] AC5 — Dado que toca "Descargar boleta", entonces se abre en pestaña nueva el `receipt_url` de Stripe de esa compra; si la orden no tiene pago asociado, `toast.error` y el Dialog sigue abierto.
- [ ] AC6 — Dado el id de una orden de OTRO usuario en `/api/orders/:id/receipt`, entonces 404 sin llamar a Stripe. Sin sesión, 401 JSON en ambos endpoints.
- [ ] AC7 — `GET /api/orders` nunca devuelve órdenes ajenas: el `userId` sale de la sesión, jamás de la query.

## Datos
Sin cambios de esquema. Lectura de `orders` (filtrada por `user_id`,
`status IN ('paid','fulfilled')` y `created_at` entre el rango) + sus
`order_items`. El índice `orders_user_created_at_idx` ya cubre la consulta.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/orders?from=&to=` | `requireSessionUser` | — | 200 `OrderWithItems[]` (desc por fecha) · 400 rango inválido · 401 · 500 |
| GET | `/api/orders/:id/receipt` | `requireSessionUser` | — | 200 `{ url }` · 404 no existe o no es suya · 409 sin boleta todavía · 401 · 500 |

Zod `orderRangeQuerySchema` en `src/modules/orders/schemas/order.schema.ts`:
`from` y `to` opcionales (`z.iso.date()`, `YYYY-MM-DD`), refine `from <= to`.
Sin params → mes actual, resuelto en el cliente al armar la query.

## Reutilizar
- `src/server/repositories/order.repository.ts` — `getById(id)` (ya valida formato UUID) para el ownership de la boleta; ahí mismo va el nuevo `listByUser`.
- `src/lib/auth.ts` — `requireSessionUser()` (401 JSON, `user.id` local).
- `src/lib/stripe.ts` — instancia única; `src/lib/money.ts` — `formatPrice`.
- `src/app/api/cart/route.ts` — patrón de handler; `src/app/api/products/route.ts` — patrón `safeParse` sobre `searchParams`.
- `src/modules/cart/services/cart.service.ts` + `hooks/use-cart.ts` — patrón service axios / `useQuery` con key exportada.
- `src/modules/checkout/hooks/use-checkout.ts` — patrón `useMutation` + `toast.error` con `getApiErrorMessage` (`src/lib/api-error.ts`).
- `src/modules/cart/types/cart.ts` — patrón de `export type` puente hacia `server/`.
- `src/modules/products/components/delete-product-dialog.tsx` — uso de `Dialog` (base-ui: `render`, no `asChild`).
- `src/components/ui/`: `dialog`, `card`, `button`, `select`, `input` (`type="date"`), `badge`, `skeleton`, `separator`. **Nada que instalar**: sin `calendar` ni `react-day-picker`.
- `src/app/(storefront)/profile/page.tsx` — `EmptySection` y `dateFormatter` (`Intl` es-AR) ya viven ahí.

## Tareas
- [x] T1 — Repo `listByUser(userId, { from, to })`: órdenes `paid`/`fulfilled` del rango, desc por `created_at`, + ítems en UNA segunda query con `inArray(orderItems.orderId, ids)` · `src/server/repositories/order.repository.ts`
- [x] T2 — `orderRangeQuerySchema` + tipo inferido · `src/modules/orders/schemas/order.schema.ts`
- [x] T3 — `GET /api/orders`: guard, `safeParse` de `searchParams`, `to` inclusive (< día siguiente) · `src/app/api/orders/route.ts`
- [x] T4 — `GET /api/orders/:id/receipt`: guard → `getById` → `order.userId !== user.id` ⇒ 404 → sin `stripePaymentIntentId` ⇒ 409 → `paymentIntents.retrieve(id, { expand: ["latest_charge"] })` → `receipt_url` (null ⇒ 409) · `src/app/api/orders/[id]/receipt/route.ts`
- [x] T5 — Agregar `"/api/orders(.*)"` al matcher `isJsonApi` · `src/proxy.ts`
- [x] T6 — Tipo puente `export type { OrderWithItems }` desde el repo (`import type`, se borra en compilación) · `src/modules/orders/types/order.ts`
- [x] T7 — Service axios: `listOrders(range)`, `getReceiptUrl(orderId)` · `src/modules/orders/services/order.service.ts`
- [x] T8 — Hooks: `ordersKey(range)` + `useOrders(range)` (`useQuery`) y `useReceipt()` (`useMutation`, `onSuccess` → `window.open(url, "_blank")`, `onError` → `toast.error`) · `src/modules/orders/hooks/use-orders.ts`
- [x] T9 — `OrderDetailDialog`: ítems, total, estado y botón "Descargar boleta" cableado a `useReceipt` (texto "Abriendo…" mientras `isPending`) · `src/modules/orders/components/order-detail-dialog.tsx`
- [x] T10 — `PurchasesSection` (`"use client"`): filtro mes actual/rango con `Select` + dos `Input type="date"`, `useOrders`, skeleton/error/vacío, agrupación por día con un helper local y encabezado formateado · `src/modules/orders/components/purchases-section.tsx`
- [x] T11 — Reemplazar el `EmptySection` de "Mis compras" por `<PurchasesSection />`; la página sigue sin `"use client"` · `src/app/(storefront)/profile/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- Ítems en una sola query con `inArray`, nunca un `getBySessionId` por fila: eso es N+1.
- La boleta es el `receipt_url` del Charge (verificado en `node_modules/stripe/esm/resources/Charges.d.ts:186`): página hosted de Stripe, imprimible a PDF, siempre al día con reembolsos. Un PDF real (`invoice_pdf`) exigiría `invoice_creation: { enabled: true }` en la sesión de la 017 y solo valdría para compras futuras — spec aparte si el negocio lo pide.
- No cachear ni guardar el `receipt_url`: es un link firmado por Stripe y se pide on-demand al abrir el Dialog, un pedido por click.
- Ownership por 404 (no 403): un 403 confirma que ese id existe.
- Review 1: en modo "Rango custom" la query queda deshabilitada hasta tener `from` **y** `to` (un rango a medias hace que `listByUser` devuelva el historial completo). Mientras falte alguno se muestra un aviso en lugar del skeleton.
- `from`/`to` llegan como fecha sin hora y se comparan contra `timestamptz`: interpretarlas en la zona del servidor puede correr los bordes del rango ±1 día para el usuario. Aceptado; si molesta, se manda el offset desde el cliente.
