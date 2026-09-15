---
id: 018
title: Stripe — webhook y fulfillment del pedido
status: in-review
module: orders
scope: client
---

# 018 — Stripe: webhook y fulfillment del pedido

Traduce `docs/stripe/stripe-checkout.md` P6, P10 y §8. **Depende de la spec 017**
(tablas, `src/lib/stripe.ts`, `order.repository`, páginas de retorno).

## Objetivo
Un pago confirmado por Stripe deja el pedido en `fulfilled`: stock descontado,
carrito vacío y traza en `audit_logs`, aunque el usuario cierre la pestaña.

## Alcance
Incluye:
- `POST /api/webhooks/stripe` con verificación de firma sobre el body crudo.
- Eventos: `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`.
- `order.repository`: `markPaid`, `fulfill`, `markFailed`, `markExpired`.
- Página de éxito mostrando el estado real.

No incluye:
- Cualquier escritura desde `/checkout/success` (regla de oro §5: el fulfillment vive solo acá).
- Reserva de stock, sobreventa, reembolsos, emails, admin de pedidos, limpieza de `pending` viejas.
- Alta del endpoint en el Dashboard de producción (checklist §9, lo hace el usuario).

## Criterios de aceptación
- [ ] AC1 — Dado un pago con `4242 4242 4242 4242` entonces la order pasa a `fulfilled`, `products.stock` bajó por cada ítem, los `cart_items` del usuario quedan vacíos y hay una fila `order.paid` en `audit_logs`.
- [ ] AC2 — Dado que se reenvía el mismo evento (`stripe events resend <id>`) entonces nada cambia: ni stock, ni carrito, ni una segunda fila de auditoría, y la respuesta sigue siendo 200.
- [ ] AC3 — Dado un `stripe-signature` inválido o ausente entonces 400 y no se toca la base.
- [ ] AC4 — Dado un evento con `payment_status === "unpaid"` entonces se responde 200 sin cumplir nada.
- [ ] AC5 — Dado `checkout.session.async_payment_failed` entonces la order queda `failed`; dado `checkout.session.expired`, queda `expired`.
- [ ] AC6 — Dado un evento de un tipo no manejado entonces 200 sin efectos.
- [ ] AC7 — Dado que al cumplir un ítem tiene `stock < quantity` entonces la order queda `paid` (no `fulfilled`), se escribe `order.fulfillment_failed` con `severity: "error"`, no se descuenta stock parcial y la respuesta es 200.
- [ ] AC8 — Dado que entro a `/checkout/success?session_id=...` después del webhook entonces veo el pedido confirmado; si todavía está `pending`, el mensaje de "estamos confirmando tu pago".

## Datos
Sin cambios de esquema: `orders`, `order_items`, `products.stock`, `cart_items` y
`audit_logs` ya existen (017). `stripe_payment_intent_id` se llena acá.

Transiciones válidas: `pending → paid → fulfilled`, `pending → failed`, `pending → expired`.
Una order ya `paid`/`fulfilled` nunca vuelve atrás.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/stripe` | firma `stripe-signature` (`STRIPE_WEBHOOK_SECRET`) | raw de Stripe | 200 `{ ok: true }` · 400 firma inválida · 500 solo error de infra |

**Sin Zod**: la garantía la da `stripe.webhooks.constructEvent(body, sig, secret)`,
que además tipa el evento. `await request.text()` — nunca `request.json()`, parsear
rompe la firma.

## Reutilizar
- `src/app/api/webhooks/clerk/route.ts` — patrón exacto: `const ok = () => NextResponse.json({ ok: true })`, 400 a firma inválida, `switch` sobre el evento, 200 por defecto.
- `src/lib/stripe.ts` (017) — la instancia; `src/server/repositories/order.repository.ts` (017) — `getBySessionId`.
- `src/lib/audit.ts` — `logAudit(tx, entry)` con `actorId: null` (lo escribe el webhook, no una persona).
- `src/server/db/index.ts` — `db.transaction()` y el tipo `Tx`.
- `src/proxy.ts` — `/api/webhooks(.*)` ya es público: **nada que tocar**.
- `STRIPE_WEBHOOK_SECRET` ya está en `.env.local` y `.env.example`.
- `src/server/repositories/cart.repository.ts` — el borrado del carrito va en `order.repository.fulfill` porque comparte la transacción; no se reusa `removeItem` fila por fila.

## Tareas
- [x] T1 — Repo `markPaid(sessionId, paymentIntentId)`: `UPDATE ... WHERE status = 'pending'` con `returning`; devuelve `{ order, alreadyDone }` — idempotente, no toca una order ya `paid`/`fulfilled` · `src/server/repositories/order.repository.ts`
- [x] T2 — Repo `fulfill(orderId)` en una tx: descuenta `stock` con guard `stock >= quantity` (falla → error, la tx entera revierte), borra `cart_items` del dueño, `logAudit` `order.paid`, order → `fulfilled` · mismo archivo
- [x] T3 — Repo `markFailed(sessionId)` / `markExpired(sessionId)`, solo desde `pending` · mismo archivo
- [x] T4 — Handler del webhook: firma, `switch` de los cuatro eventos, guard `payment_status !== "unpaid"`, `markPaid` → `fulfill` solo si `!alreadyDone` · `src/app/api/webhooks/stripe/route.ts`
- [x] T5 — En el handler, si `fulfill` falla por stock: `logAudit` `order.fulfillment_failed` (`severity: "error"`, en su propia tx), `console.error` y 200 — reintentar no crea stock · mismo archivo
- [x] T6 — Página de éxito: mensaje por `status` (`fulfilled`/`paid` → confirmado; `pending` → confirmando; `failed`/`expired` → link al carrito) · `src/app/(storefront)/checkout/success/page.tsx`
- [x] T7 — Etiquetas de bitácora `order.paid` y `order.fulfillment_failed` · `src/modules/audit/lib/audit-labels.ts`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- Prueba manual: `stripe listen` ya corriendo → `stripe trigger checkout.session.completed` (order inventada: cae en el `getBySessionId` nulo → 200 sin efectos, esa rama tiene que existir) y después un pago real de prueba desde el carrito.
- El descuento de stock va en un solo `UPDATE ... SET stock = stock - $qty WHERE id = $id AND stock >= $qty` por ítem, verificando `rowCount`: leer y después escribir abre un race con otra compra simultánea.
- `markPaid` condicionado por `status = 'pending'` en el propio `WHERE` es lo que da la idempotencia; un `SELECT` previo y un `if` no alcanzan si Stripe entrega el evento dos veces en paralelo.
- Nada de datos de tarjeta ni el objeto `payment_intent` completo en `audit_logs`: alcanza `session.id` en `metadata`.
