# Integración de pagos — Stripe Checkout

Documento de referencia para incorporar cobros al e-commerce usando **Stripe
Checkout (hosted)** como primer paso. No es código todavía: es el plan que
después entra por el `orchestrator` como spec `017-stripe-checkout`.

- Stack objetivo: Next.js 16 · Route Handlers · Drizzle · Neon · Clerk.
- API de Stripe: `2026-07-29.dahlia` (la última). SDK Node: `stripe@22.x`.
- Modo: `payment` (pago único). Sin suscripciones.

---

## 1. ¿Conviene sincronizar la base de productos con Stripe?

**No, no ahora.** La base de datos sigue siendo la única fuente de verdad del
catálogo y Stripe no se entera de que existen productos.

### Por qué

Para Stripe Checkout en modo `payment` no hace falta que Stripe conozca tus
productos. La Checkout Session se arma en el servidor con `line_items` que llevan
un **`price_data` en línea**, construido al vuelo desde tu base en el momento de
crear la sesión:

```ts
line_items: cart.map((item) => ({
  quantity: item.quantity,
  price_data: {
    currency: "pen",
    unit_amount: item.price, // ya está en centavos, es el mismo entero
    product_data: { name: item.name, images: item.imageUrl ? [item.imageUrl] : [] },
  },
})),
```

Mantener un catálogo espejo en Stripe (tabla `stripe_products` / columna
`stripe_price_id`) implica:

- Sincronizar en cada alta, edición de precio, cambio de nombre y baja
  (webhooks Stripe→DB y escrituras DB→Stripe).
- Manejar la deriva cuando las dos fuentes discrepan.
- Los `Price` de Stripe son **inmutables**: cambiar un precio obliga a crear un
  `Price` nuevo y archivar el viejo. Eso es correcto para suscripciones, es
  fricción pura para un catálogo que se edita seguido.

Todo eso para resolver un problema que `price_data` en línea ya resuelve gratis.

### Qué sí necesitás en tu base

El registro del pedido. Stripe no es tu sistema de pedidos: guarda transacciones,
no el detalle de negocio con precio congelado. Por eso este documento crea
`orders` y `order_items` (ya anticipadas en `docs/SETUP.md` §5.3).

### Cuándo reevaluar (y crear `stripe_price_id`)

- Migrás a **Payment Links** (checkout sin código, requiere `Price` reales).
- Agregás **suscripciones** o **precios recurrentes**.
- Querés analítica **por producto** dentro del dashboard de Stripe (con
  `price_data` en línea cada ítem aparece como producto ad-hoc y el reporte
  de "top products" de Stripe queda inservible).

Si llega ese momento, la forma barata es **creación lazy unidireccional**:
la primera vez que un producto se vende, se crea su `Product`/`Price` en Stripe
y se cachea `stripe_price_id` en la fila. Nunca un job de sincronización total.

---

## 2. Qué se agrega al proyecto

### Dependencias

```bash
npm i stripe
```

Solo el SDK de servidor. Con Checkout **hosted** el navegador se redirige a
`session.url` y vuelve; no hace falta `@stripe/stripe-js` ni `@stripe/react-stripe-js`
(eso recién entra si algún día se quiere el formulario **embebido** con Payment
Element).

### Variables de entorno (`.env.example` y `.env.local`)

```bash
# Stripe — clave restringida (rk_...), NO la secreta (sk_...).
# Scopes mínimos: Checkout Sessions [write], PaymentIntents [read],
#                 Webhook Endpoints [read]. Products/Prices no hacen falta.
STRIPE_SECRET_KEY=""

# Firma de los webhooks de Stripe. La lee `stripe.webhooks.constructEvent()`
# en /api/webhooks/stripe. Formato: whsec_...
# De dónde sale: en local, del output de `stripe listen`. En prod, del
# endpoint dado de alta en Dashboard → Developers → Webhooks.
STRIPE_WEBHOOK_SECRET=""
```

`NEXT_PUBLIC_APP_URL` ya existe y se reutiliza para `success_url` / `cancel_url`.

> **Moneda:** el proyecto factura en **PEN** (`src/lib/money.ts`). PEN tiene 2
> decimales, así que `products.price` (centavos, entero) es exactamente el
> `unit_amount` que Stripe espera. Cero conversión. Antes de ir a producción,
> confirmá que el país de la cuenta de Stripe admite cobrar en PEN; si no, hay
> que cobrar en la moneda de liquidación de la cuenta y convertir en el borde.

---

## 3. Modelo de datos nuevo

Dos tablas. Requieren migración (`npm run db:generate` + `npm run db:migrate`).

### `orders` — `src/server/db/schema/order.ts`

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → `users.id` `onDelete: restrict` | dueño del pedido |
| `status` | enum `pending` \| `paid` \| `failed` \| `expired` \| `fulfilled` | ver máquina de estados abajo |
| `currency` | text | `pen` |
| `total_amount` | integer | centavos, suma de los ítems al momento de crear la sesión |
| `stripe_checkout_session_id` | text | **único**, la usa el webhook para encontrar el pedido |
| `stripe_payment_intent_id` | text nullable | se llena al pagar |
| `created_at` / `updated_at` | timestamptz | `defaultNow()` / `$onUpdate` |

Índices: `uniqueIndex(stripe_checkout_session_id)`, `index(user_id, created_at desc)`, `index(status)`.

### `order_items` — `src/server/db/schema/order-item.ts`

| columna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `order_id` | uuid FK → `orders.id` `onDelete: cascade`, notNull | |
| `product_id` | uuid FK → `products.id` `onDelete: restrict`, notNull | |
| `name` | text notNull | **snapshot** del nombre al comprar |
| `unit_price` | integer notNull | **snapshot** del precio en centavos |
| `quantity` | integer notNull | |

`name` y `unit_price` son copia congelada: si mañana cambia el precio o el
producto se da de baja, el pedido histórico no se toca.

### Máquina de estados

```
                 crear sesión           webhook: session.completed (payment_status = paid)
   [ carrito ] ────────────────► pending ──────────────────────────────────────► paid
                                   │  │                                            │
        webhook: expired / async_payment_failed                     fulfillment OK │
                                   │  └──────────────► failed / expired            ▼
                                   │                                          fulfilled
                                   └── (sesión abandonada: queda pending, TTL lo limpia)
```

`fulfilled` = ya se descontó stock, se vació el carrito y se escribió el
`audit_log`. Separado de `paid` para que el fulfillment sea reintentable e
idempotente sin volver a cobrar.

---

## 4. Arquitectura por capas

Respeta `docs/SETUP.md`: el componente habla con un hook, el hook con un service
axios, el service con un Route Handler, el handler con un repositorio/servicio de
servidor, y solo ahí se toca Drizzle.

```
src/
├── lib/
│   └── stripe.ts                         instancia única de StripeClient (como lib/axios.ts)
├── server/
│   ├── repositories/
│   │   └── order.repository.ts           createPendingOrder (tx), markPaid, markFulfilled, getBySessionId
│   └── services/
│       └── checkout.service.ts           reglas: revalida carrito, arma line_items, crea la Session
├── app/
│   ├── api/
│   │   ├── checkout/route.ts             POST → { url }   (requireSessionUser + Zod)
│   │   └── webhooks/stripe/route.ts      POST ← Stripe    (verificación de firma, fulfillment)
│   └── (storefront)/
│       └── checkout/
│           ├── success/page.tsx          Server Component: lee la sesión, muestra confirmación
│           └── cancel/page.tsx           vuelve al carrito
├── modules/checkout/
│   ├── schemas/checkout.schema.ts        Zod de entrada del POST
│   ├── services/checkout.service.ts      axios: startCheckout()
│   └── hooks/use-checkout.ts             useMutation → redirige a data.url
└── proxy.ts                              /api/webhooks(.*) ya es público; /api/checkout va al matcher JSON
```

---

## 5. Flujo end-to-end

```
Usuario                 Next.js (nuestro server)              Stripe
  │                            │                                │
  │  click "Iniciar compra"    │                                │
  ├───────────────────────────►│ POST /api/checkout             │
  │                            │  requireSessionUser()          │
  │                            │  lee carrito (cart.repository) │
  │                            │  revalida precio/stock vivos   │
  │                            │  crea order 'pending' + items  │
  │                            ├───────────────────────────────►│ checkout.sessions.create
  │                            │                                │  (line_items con price_data)
  │                            │◄───────────────────────────────┤ { id, url }
  │                            │  guarda session.id en la order │
  │◄───────────────────────────┤ { url }                        │
  │  redirect a session.url    │                                │
  ├────────────────────────────┼───────────────────────────────►│ paga en la página de Stripe
  │◄───────────────────────────┼────────────────────────────────┤ redirect a success_url
  │  ve /checkout/success      │                                │
  │  (solo muestra, NO cumple) │                                │
  │                            │◄───────────────────────────────┤ POST /api/webhooks/stripe
  │                            │  constructEvent(rawBody, sig)   │  checkout.session.completed
  │                            │  payment_status === 'paid'?     │
  │                            │  tx: order→paid, -stock,        │
  │                            │      vaciar carrito, audit_log, │
  │                            │      order→fulfilled            │
  │                            ├──── 200 ──────────────────────►│
```

**Regla de oro:** el fulfillment (descontar stock, vaciar carrito, marcar
pagado) vive **solo en el webhook**, nunca en `/checkout/success`. El usuario
puede pagar y cerrar la pestaña antes de que cargue la página de éxito; si la
lógica estuviera ahí, ese pedido se perdería.

---

## 6. Paso a paso

### P0 — Cuenta y CLI

Sin cuenta todavía: `npm i -g @stripe/cli` y `stripe sandbox create` genera
claves de prueba sin registro. Con cuenta: sacá la **restricted key** (`rk_`)
del Dashboard con los scopes de la sección 2.

```bash
stripe login                 # o: stripe sandbox create
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copiá el whsec_... que imprime → STRIPE_WEBHOOK_SECRET
```

### P1 — `src/lib/stripe.ts`

Instancia única. **Nunca** el patrón global deprecado (`stripe.api_key = ...`).

```ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Falta STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
});
```

### P2 — Schemas Drizzle + migración

`order.ts` y `order-item.ts` según la sección 3, exportados en
`src/server/db/schema/index.ts`. Tipos inferidos con `InferSelectModel`, no a
mano. Después:

```bash
npm run db:generate
npm run db:migrate
```

### P3 — `src/server/repositories/order.repository.ts`

- `createPendingOrder(userId, items[])` — **una transacción**: inserta la `order`
  en `pending`, inserta los `order_items` con el snapshot, escribe el `audit_log`
  (`order.created`). Devuelve el `orderId`.
- `attachSession(orderId, sessionId)` — guarda `stripe_checkout_session_id`.
- `getBySessionId(sessionId)` — con sus ítems. La usan el webhook y la página de
  éxito.
- `markPaid(sessionId, paymentIntentId)` — `pending → paid`. Idempotente: si ya
  está `paid`/`fulfilled`, no hace nada y avisa que ya estaba.
- `fulfill(orderId)` — **una transacción**: descuenta `products.stock` con guard
  `stock >= quantity`, borra las filas de `cart_items` del usuario, escribe
  `audit_log` (`order.paid`), pasa la order a `fulfilled`.

### P4 — `src/server/services/checkout.service.ts`

Regla de negocio que cruza repositorios. `createCheckoutSession(user)`:

1. `cart.repository.listByUser(user.id)` → si está vacío, error 400.
2. Revalida contra datos vivos: todo ítem `isActive` y `stock >= quantity`. Si
   algo cambió, error 409 con el detalle (el front refresca el carrito).
3. `order.repository.createPendingOrder(user.id, items)`.
4. `stripe.checkout.sessions.create({...})` (parámetros en la sección 7), con
   **idempotency key** = `orderId` (dos clicks seguidos no crean dos sesiones).
5. `order.repository.attachSession(orderId, session.id)`.
6. Devuelve `session.url`.

### P5 — `src/app/api/checkout/route.ts`

```ts
export async function POST() {
  const guard = await requireSessionUser();
  if (!guard.ok) return guard.response;

  try {
    const url = await createCheckoutSession(guard.user);
    return NextResponse.json({ url });
  } catch (err) {
    // errores propagados con su status; nada de catch {}
    return toApiError(err);
  }
}
```

No lleva body (el carrito vive en el servidor), así que no hay Zod de entrada acá.
Si más adelante se acepta "comprar solo este producto", ahí entra el schema.

### P6 — `src/app/api/webhooks/stripe/route.ts`

Mismo patrón que el webhook de Clerk que ya existe: verificación criptográfica en
vez de Zod, responde 200 salvo error de infra (Stripe reintenta ante 4xx/5xx).

```ts
export async function POST(request: NextRequest) {
  const body = await request.text();               // RAW, sin parsear
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("stripe-webhook: firma inválida", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status === "unpaid") return NextResponse.json({ ok: true });

      const { alreadyDone } = await markPaid(session.id, session.payment_intent as string);
      if (!alreadyDone) {
        const order = await getBySessionId(session.id);
        await fulfill(order.id);
      }
      return NextResponse.json({ ok: true });
    }

    case "checkout.session.async_payment_failed":
      await markFailed((event.data.object).id);
      return NextResponse.json({ ok: true });

    case "checkout.session.expired":
      await markExpired((event.data.object).id);
      return NextResponse.json({ ok: true });

    default:
      return NextResponse.json({ ok: true });
  }
}
```

Claves:

- Se manejan **`checkout.session.completed` y `checkout.session.async_payment_succeeded`**
  (métodos de pago diferidos avisan tarde), y solo se cumple si
  `payment_status !== "unpaid"`.
- **Idempotente**: `markPaid` corta si el pedido ya estaba pagado. Stripe puede
  entregar el mismo evento más de una vez.
- El fulfillment es su propia transacción y puede reintentarse solo.

### P7 — `src/proxy.ts`

- `/api/webhooks(.*)` ya está en `isPublicRoute` — Stripe no manda sesión de
  Clerk, así que tiene que quedar público. Nada que tocar.
- Agregar `/api/checkout` al matcher `isJsonApi` (junto a `/api/cart` y
  `/api/admin`) para que el borde no lo corte con 404 HTML y el guard del handler
  responda 401 JSON.

### P8 — Capa cliente

- `src/modules/checkout/services/checkout.service.ts` — `startCheckout()`:
  `api.post("/checkout")` → `{ url }`.
- `src/modules/checkout/hooks/use-checkout.ts` — `useMutation`; en `onSuccess`,
  `window.location.href = data.url`. En `onError`, `toast.error(getApiErrorMessage(err))`
  (mismo patrón que `AddToCartButton`).
- `src/modules/cart/components/cart-drawer.tsx` — el botón que hoy dice
  `Iniciar compra · Próximamente` y está `disabled` pasa a llamar la mutación,
  con estado `isPending` ("Redirigiendo…").

### P9 — Páginas de retorno

- `src/app/(storefront)/checkout/success/page.tsx` — Server Component. Lee
  `?session_id=`, hace `getBySessionId`, muestra el resumen del pedido y un
  mensaje según `status` (`paid`/`fulfilled` → "listo"; `pending` →
  "estamos confirmando tu pago"). **No escribe nada.**
- `src/app/(storefront)/checkout/cancel/page.tsx` — mensaje corto + link al
  carrito. El pedido `pending` queda; lo limpia el TTL.

### P10 — Auditoría

`order.created`, `order.paid` y `order.fulfillment_failed` se escriben en
`audit_logs` **dentro de la misma transacción** que su mutación (regla dura 9 de
`CLAUDE.md`). Sin datos de tarjeta ni el `payment_intent` completo en el log: el
`session.id` alcanza para rastrear.

---

## 7. Parámetros de la Checkout Session

```ts
await stripe.checkout.sessions.create(
  {
    mode: "payment",
    line_items: /* price_data en línea desde el carrito, sección 1 */,

    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,

    client_reference_id: user.id,            // nuestro users.id
    customer_email: user.email,              // lo tenemos espejado de Clerk
    metadata: { orderId },                   // atajo para el webhook

    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,  // 30 min
    integration_identifier: "ecommerce-checkout-<8 letras random>",
  },
  { idempotencyKey: orderId },
);
```

**Prohibido** pasar `payment_method_types`. Omitirlo activa los *dynamic payment
methods*: Stripe elige y ordena los medios de pago por conversión, y se
configuran desde el Dashboard sin tocar código. Si en algún momento hay que
restringir, se usa `payment_method_configurations` o `excluded_payment_method_types`,
nunca `payment_method_types`.

`automatic_tax` queda **apagado**. Encenderlo sin una registración de impuestos
activa hace que Stripe no cobre nada mientras creés que sí. Si se necesita IGV,
es otro spec con Stripe Tax + Registrations.

---

## 8. Testing local

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Tarjetas de prueba (`/stripe:test-cards` para la lista completa):

| Nº | Resultado |
|---|---|
| `4242 4242 4242 4242` | pago OK |
| `4000 0000 0000 0002` | tarjeta rechazada |
| `4000 0025 0000 3155` | requiere 3D Secure |

Fecha futura cualquiera, CVC cualquiera, ZIP cualquiera.

Disparar eventos sin pagar a mano:

```bash
stripe trigger checkout.session.completed
```

Checklist de prueba manual:

- [ ] Carrito vacío → botón deshabilitado / 400.
- [ ] Precio cambiado en `/admin/products` entre agregar y pagar → 409, el
      carrito se refresca.
- [ ] Pago OK → `orders.status = fulfilled`, `products.stock` bajó, `cart_items`
      del usuario vacío, fila en `audit_logs`.
- [ ] Reenviar el mismo evento (`stripe events resend <id>`) → no cambia nada
      (idempotencia).
- [ ] Cancelar en la página de Stripe → vuelve a `/checkout/cancel`, la order
      queda `pending`.
- [ ] `checkout.session.expired` → order `expired`.

---

## 9. Checklist antes de producción

- [ ] `STRIPE_SECRET_KEY` es una **restricted key** (`rk_`) con scopes mínimos.
- [ ] Endpoint de webhook dado de alta en Dashboard → Webhooks, apuntando a
      `https://<dominio>/api/webhooks/stripe`, eventos: `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
      `checkout.session.expired`.
- [ ] `STRIPE_WEBHOOK_SECRET` de producción cargado (distinto al de `stripe listen`).
- [ ] Firma verificada en el handler (ya está en P6).
- [ ] Fulfillment idempotente probado con evento repetido.
- [ ] El país de la cuenta admite cobrar en **PEN** (o se define moneda de cobro).
- [ ] Medios de pago elegidos en Dashboard → Settings → Payment methods.
- [ ] TTL / job que limpia `orders` en `pending` viejas (o se aceptan y se
      revisan a mano al principio).
- [ ] `npm run typecheck && npm run lint && npm run build` en verde.
- [ ] Revisión con la skill `security-review` (toca pagos y datos de usuario).

---

## 10. Fuera de alcance (specs futuros)

| Tema | Cuándo | Nota |
|---|---|---|
| Payment Element **embebido** | si se quiere el formulario dentro del sitio | `ui_mode: "custom"` respaldado por Checkout Sessions; suma `@stripe/stripe-js` |
| `stripe_price_id` en productos | Payment Links, suscripciones o analítica por producto en Stripe | creación lazy unidireccional, nunca sync total (sección 1) |
| Stripe Tax / IGV | cuando el negocio lo exija | requiere registración activa; `automatic_tax` sin ella no cobra nada |
| Reserva de stock | si hay sobreventa real | hoy: guard `stock >= qty` en el fulfillment y revisión manual del caso raro |
| Reembolsos desde el admin | gestión de pedidos | `stripe.refunds.create` + estado `refunded` |
| Carrito y checkout de invitado | si se pide compra sin cuenta | hoy el checkout exige sesión, igual que el carrito (spec 012) |

---

## 11. Referencias

- Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions
- Fulfillment por webhook: https://docs.stripe.com/checkout/fulfillment
- Dynamic payment methods: https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods
- Verificar webhooks: https://docs.stripe.com/webhooks#verify-events
- Go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Skills del plugin: `stripe:test-cards`, `stripe:explain-error`, `stripe:stripe-docs`
