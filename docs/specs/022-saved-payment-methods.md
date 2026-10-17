---
id: 022
title: Tarjetas guardadas en el perfil
status: done
module: checkout
scope: client
---

# 022 — Tarjetas guardadas y pago con tarjeta guardada

## Objetivo
Un cliente puede guardar tarjetas desde `/profile` y elegir una de ellas al pagar,
sin volver a tipear el número.

## Alcance
Incluye:
- Tab «Mis tarjetas» en `/profile` con lista, alta y baja.
- Alta vía Checkout Session en `mode: "setup"` (SetupIntent hospedado por Stripe).
- Persistencia local de la referencia: `pm_...`, marca y últimos 4.
- Reuso al pagar: la Checkout Session de la spec 017 pasa a recibir `customer`, con lo
  que Stripe hospedado ya lista las tarjetas de ese customer para elegir.

No incluye:
- **Cobro off-session** (`PaymentIntent` con `off_session: true`). No hace falta: el
  usuario siempre está presente en el checkout, y off-session agrega manejo de SCA,
  `requires_action` y reintentos. Entra solo si aparecen suscripciones o 1-click real.
- UI propia de selección al pagar (la pinta Stripe), tarjeta predeterminada, edición de
  tarjeta, ni ofrecer «guardar esta tarjeta» durante el pago.
- Formulario propio de tarjeta (Payment Element). El PAN nunca toca nuestro dominio.

**Aclaración PCI (corrige el requerimiento):** Stripe no expone el PAN. Solo devuelve
`brand` (visa, mastercard, amex…) y `last4`; los 4 primeros dígitos no están
disponibles por API. `brand` ya identifica a la empresa emisora, que es el fin pedido.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario autenticado en `/profile`, cuando abre «Mis tarjetas» y pulsa «Agregar tarjeta», entonces es redirigido a una página de Stripe en modo setup (sin cobro).
- [ ] AC2 — Dado que completó el setup en Stripe, cuando vuelve a `/profile?tab=cards`, entonces la tarjeta aparece listada como «Visa •••• 4242».
- [ ] AC3 — Dado una tarjeta listada, cuando confirma «Eliminar», entonces desaparece de la lista y queda desasociada (`detach`) en Stripe.
- [ ] AC4 — Dado un usuario con tarjetas guardadas, cuando inicia el checkout normal, entonces la página de Stripe lista esas tarjetas como opción preseleccionable y puede pagar eligiendo una, sin tipear el número.
- [ ] AC5 — Dado un usuario sin `stripe_customer_id` (nunca guardó tarjeta), cuando paga, entonces el checkout funciona igual que hoy con `customer_email`. Sin regresión sobre la spec 017.
- [ ] AC6 — Dado un usuario sin tarjetas, cuando abre el tab, entonces ve estado vacío; y estados de carga/error cubiertos.
- [ ] AC7 — Dado un `DELETE` con el id de una tarjeta de otro usuario, entonces responde 404 y no borra nada.

## Datos
Migración requerida (`npm run db:generate` + `db:migrate`).

`users` — columna nueva:
- `stripe_customer_id` · `text` · nullable · `uniqueIndex` parcial-no (unique simple).

`payment_methods` — tabla nueva:
- `id` · `uuid` · PK `gen_random_uuid()`
- `user_id` · `uuid` · NOT NULL · FK → `users.id` `onDelete: cascade`
- `stripe_payment_method_id` · `text` · NOT NULL · `uniqueIndex` (idempotencia del webhook)
- `brand` · `text` · NOT NULL
- `last4` · `text` · NOT NULL
- `created_at` · `timestamptz` · NOT NULL · `defaultNow()`
- index en `user_id`

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/payment-methods/setup-session` | sesión | — | `{ url: string }` |
| GET | `/api/payment-methods` | sesión | — | `PaymentMethod[]` |
| DELETE | `/api/payment-methods/[id]` | sesión | — | `{ ok: true }` / 404 |

Zod: `paymentMethodIdParamSchema` (`{ id: z.uuid() }`) para el param del DELETE.
POST y GET no reciben body ni query: sin Zod, igual criterio que `/api/checkout`.

Checkout de pago (`POST /api/checkout`, spec 017): mismo contrato de request/response.
Cambia solo el cuerpo de la sesión Stripe: `customer: stripeCustomerId` cuando existe
(excluyente con `customer_email`) y `saved_payment_method_options: {
allow_redisplay_filters: [...] }` para que las tarjetas del setup se listen.
Parámetro verificado contra `2026-08-26.dahlia`; el valor final del array y su
porqué están en «Implementación — verificaciones y desvíos».

Webhook: se extiende el `switch` existente de `src/app/api/webhooks/stripe/route.ts`
en `checkout.session.completed` → si `session.mode === "setup"`, se resuelve el
`setup_intent` (expandido a `payment_method`) y se guarda la fila. El resto del
evento sigue yendo a `handlePaid`.

## Reutilizar
- `src/lib/stripe.ts` — cliente Stripe único. No crear otro.
- `src/lib/auth.ts` · `requireSessionUser()` — guard de los 3 handlers.
- `src/app/api/webhooks/stripe/route.ts` — firma ya verificada; solo agregar la rama.
- `src/server/services/checkout.service.ts` — patrón de `CheckoutResult` (unión discriminada) y de `APP_URL`/`INTEGRATION_IDENTIFIER`.
- `src/modules/orders/services/order.service.ts` + `hooks/use-orders.ts` — plantilla exacta de service axios + hook TanStack (query + mutation con `toast` y `getApiErrorMessage`).
- `src/modules/orders/components/purchases-section.tsx` — plantilla de sección client con `Skeleton`, error y estado vacío.
- `src/components/shared/profile-tabs.tsx` — donde se agrega el tab.
- `src/components/ui/`: `card`, `button`, `skeleton`, `dialog`, `sonner` ya instalados. **No hace falta instalar ningún componente shadcn.**
- `src/modules/customers/` — carpetas ya creadas y vacías; ahí va el módulo cliente.

## Tareas
- [x] T1 — Agregar `stripeCustomerId` a la tabla `users` · `src/server/db/schema/user.ts`
- [x] T2 — Crear tabla `paymentMethods` + tipos inferidos y export · `src/server/db/schema/payment-method.ts`, `index.ts`
- [x] T3 — Generar migración (`npm run db:generate`) · `drizzle/0005_cheerful_venus.sql` (aplicarla queda para el usuario)
- [x] T4 — `setStripeCustomerId(userId, customerId)` · `src/server/repositories/user.repository.ts`
- [x] T5 — Repositorio `listByUser` / `create` / `findOwned` / `deleteOwned(userId, id)` · `src/server/repositories/payment-method.repository.ts`
- [x] T6 — Servicio: `ensureStripeCustomer(user)` + `createSetupSession(user)` · `src/server/services/payment-method.service.ts`
- [x] T7 — Servicio: `savePaymentMethodFromSetupSession(session)` y `removePaymentMethod(user, id)` (detach + delete) · mismo archivo
- [x] T8 — Handler POST setup session · `src/app/api/payment-methods/setup-session/route.ts`
- [x] T9 — Handler GET lista · `src/app/api/payment-methods/route.ts`
- [x] T10 — Handler DELETE con Zod en el param · `src/app/api/payment-methods/[id]/route.ts`
- [x] T11 — Rama `mode === "setup"` en el webhook · `src/app/api/webhooks/stripe/route.ts`
- [x] T12 — Usar `customer` si existe, con fallback a `customer_email` (nunca los dos) · `src/server/services/checkout.service.ts`
- [x] T13 — Habilitar el listado de tarjetas guardadas en esa sesión (`saved_payment_method_options`) · mismo archivo
- [x] T14 — Schema Zod + tipo cliente · `src/modules/customers/schemas/payment-method.schema.ts`, `types/payment-method.ts`
- [x] T15 — Service axios · `src/modules/customers/services/payment-method.service.ts`
- [x] T16 — Hooks `usePaymentMethods`, `useAddCard`, `useRemoveCard` · `src/modules/customers/hooks/use-payment-methods.ts`
- [x] T17 — Sección client con lista, alta, baja con confirmación · `src/modules/customers/components/payment-methods-section.tsx`
- [x] T18 — Prop `defaultTab` + tab «Mis tarjetas» · `src/components/shared/profile-tabs.tsx`
- [x] T19 — Leer `searchParams.tab` y montar la sección · `src/app/(storefront)/profile/page.tsx`
- [x] T20 — (no previsto) Agregar `"/api/payment-methods(.*)"` al matcher `isJsonApi` · `src/proxy.ts`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- **Carrera webhook/redirect:** el usuario vuelve de Stripe antes de que llegue el evento. La query no debe cachear (`staleTime: 0`) y, si tras `?tab=cards&setup=done` la lista no trajo la tarjeta, mostrar un toast «Tu tarjeta se está registrando» en vez de un vacío engañoso. No sincronizar desde la página de retorno.
- **Idempotencia:** `uniqueIndex` sobre `stripe_payment_method_id` + `onConflictDoNothing` cubre el reintento del webhook. Sin eso, la tarjeta se duplica.
- **Tarjeta borrada:** el `detach` la saca del customer y Stripe deja de ofrecerla al pagar. Sin estado intermedio que limpiar.
- **Usuarios existentes:** `stripe_customer_id` arranca en `NULL`; `ensureStripeCustomer` lo crea al vuelo. Sin backfill. Un checkout con `customer` **y** `customer_email` a la vez es error 400 de Stripe: es o uno u otro.
- **Sin `payment_method_types`** en `sessions.create` (dynamic payment methods). Sin `exp_month`/`exp_year`: no se pidieron y Stripe ya gestiona el vencimiento.
- `payment_methods` no se audita: es dato del propio usuario, no acción administrativa.

## Implementación — verificaciones y desvíos

Verificado contra la doc vigente y el SDK pineado (`stripe@22`, `2026-08-26.dahlia`):

- **`saved_payment_method_options.allow_redisplay_filters` existe y ese es el nombre exacto.**
  `SessionCreateParams.SavedPaymentMethodOptions.allow_redisplay_filters?: Array<'always'|'limited'|'unspecified'>`
  (`node_modules/stripe/esm/resources/Checkout/Sessions.d.ts:2907`), confirmado también en
  `stripe docs /payments/existing-customers?platform=web&ui=stripe-hosted`. Solo disponible
  en `payment` y `subscription` mode.
- **`currency` es obligatoria en `mode: "setup"`** mientras no se pase `payment_method_types`
  (`Sessions.d.ts:2159`). Se manda `"pen"`, la misma del checkout de pago. No estaba en el spec.

Desvíos (con razón):

1. **`allow_redisplay_filters: ["always", "limited", "unspecified"]`, no `["always"]`.** La doc
   confirma que el default (y `["always"]`) muestra solo las tarjetas con `allow_redisplay: always`,
   pero **no documenta qué valor le asigna Stripe a una tarjeta guardada por Checkout en setup mode**.
   Con `["always"]` a secas, AC4 depende de un comportamiento no documentado. Los tres valores lo
   vuelven determinista a costo cero (sin llamadas extra) y sin problema de consentimiento: en esta
   integración lo único que ata una tarjeta al Customer es el alta explícita del perfil — el checkout
   de pago no guarda nada (sin `setup_future_usage`).
2. **`findOwned` agregado al repositorio (T5).** El detach en Stripe va **antes** del DELETE local:
   si se borrara primero y fallara el detach, no quedaría el `pm_...` para desasociar y la tarjeta
   seguiría apareciendo al pagar, sin forma de recuperarla desde la UI. Al revés sí hay reintento:
   el segundo detach lo rechaza Stripe y ese caso se tolera explícitamente.
3. **T20 (`src/proxy.ts`).** El spec no lo listaba, pero sin agregar `/api/payment-methods(.*)` al
   matcher `isJsonApi` los tres endpoints los cortaría `auth.protect()` con 404 HTML en vez del 401
   JSON de `requireSessionUser`. Mismo agregado que hicieron 017 (T9) y 019 (T5).
4. **Toast de la carrera webhook/redirect por prop, no por `useSearchParams()`.** La página ya lee
   `searchParams` para resolver la tab; pasar `justSetup` como prop evita meter una frontera de
   Suspense nueva en el árbol cliente.

Riesgo conocido sin cubrir: dos `POST /api/payment-methods/setup-session` simultáneos de un usuario
sin `stripe_customer_id` crean dos Customers en Stripe y el último gana. El `uniqueIndex` no lo
frena (son ids distintos) y el costo es un Customer huérfano sin tarjetas. Mismo orden de magnitud
que el hallazgo [BAJO] de rate-limit de la 017.

Verificación: `typecheck` ✓ · `lint` ✓ · `build` ✓ (33 rutas, 3 nuevas). Los AC quedan sin marcar:
necesitan la migración aplicada (`npm run db:migrate`) y un recorrido real contra Stripe test mode
con el webhook escuchando `checkout.session.completed`.
