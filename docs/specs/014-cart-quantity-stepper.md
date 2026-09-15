---
id: 014
title: Stepper de cantidad en el botón "Agregar"
status: done
module: cart
scope: client
---

# 014 — Stepper de cantidad en el botón "Agregar"

## Objetivo
Un usuario logueado ve, en el mismo lugar del botón "Agregar", cuántas unidades
de ese producto tiene en el carrito y puede sumar o restar sin abrir el drawer.

## Alcance
Incluye:
- `AddToCartButton` muestra el control +/– cuando el producto ya está en el carrito.
- Extraer el control +/– del drawer a un componente presentacional compartido.
- Tope superior por `stock` y por `MAX_QUANTITY`, en cliente **y** en servidor.
- Validación de stock en `PATCH /api/cart/[productId]`, que hoy no la tiene.

No incluye:
- Endpoints nuevos: `PATCH`/`DELETE /api/cart/[productId]` ya existen, validan con
  Zod (`setQuantitySchema`) y cortan con `requireSessionUser()`. Se les agrega una
  sola validación (ver "API"), no se crea ninguna ruta.
- Optimistic updates: sigue vigente lo decidido en 012 (mutación → `setQueryData`
  con el carrito que devuelve el servidor).
- Input numérico editable, "quitar" desde la card, cambios en el drawer más allá
  del refactor del control.
- Comportamiento anónimo: el `SignInButton mode="modal"` queda tal cual.

## Decisiones del usuario
Al bajar de 1, el `–` dispara `DELETE /api/cart/[productId]`: el ítem se quita del
carrito y el control vuelve a ser el botón "Agregar". Confirmado por el usuario.
Descartada la alternativa B (`–` deshabilitado en 1 y quitar solo desde el drawer):
obliga a abrir el drawer para deshacer un click, que es justo lo que evita esta
feature. El drawer conserva su `–` deshabilitado en 1, porque ahí sí hay botón
"Quitar" propio (AC4 y AC5 del 012 no se tocan).

## Criterios de aceptación
- [x] AC1 — Dado un producto con cantidad 0 en el carrito cuando lo miro entonces veo el botón "Agregar" actual (sin cambios).
- [ ] AC2 — Dado que toco "Agregar" entonces el botón se reemplaza por el control `– 1 +` y el drawer se abre (AC2 del 012 sigue valiendo).
- [x] AC3 — Dado el control visible cuando toco `+` entonces la cantidad sube en 1, el badge del header se actualiza y **el drawer NO se abre**.
- [ ] AC4 — Dado cantidad 1 cuando toco `–` entonces se llama `DELETE /api/cart/[productId]`, la fila desaparece del carrito, el número deja de verse y vuelvo a ver el botón "Agregar".
- [x] AC5 — Dado que ese `DELETE` falla entonces sale un toast con el error y el control sigue mostrando `1` (nunca "Agregar" ni `0`): lo que se pinta es lo que devolvió el servidor.
- [x] AC6 — Dado que la cantidad llegó a `min(stock, 99)` entonces `+` queda deshabilitado en la UI.
- [x] AC6b — Dado un `PATCH /api/cart/<id>` con `quantity` mayor al `stock` del producto (petición fabricada, sin pasar por la UI) entonces la API responde **409** y la cantidad guardada no cambia. Hoy responde 200 y la escribe: es el hueco que cierra esta tarea.
- [x] AC7 — Dado el mismo producto visible en dos lugares de la pantalla cuando cambio la cantidad en uno entonces el otro muestra el mismo número (fuente única: query `["cart"]`).
- [x] AC8 — Dado que una mutación está en vuelo entonces solo la instancia que toqué muestra el spinner y sus botones deshabilitados; el resto de las cards siguen usables.
- [x] AC9 — Dado que estoy deslogueado entonces veo "Agregar", se abre el modal de Clerk y **no hay `GET /api/cart`**.
- [x] AC10 — Dado `stock` 0 entonces sigue saliendo "Sin stock" deshabilitado, esté o no el producto en el carrito (AC7 del 012).

## Datos
Sin cambios de esquema. `CartItem` ya trae `productId`, `quantity` y `stock`
(`src/server/db/schema/cart-item.ts`).

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| PATCH | `/api/cart/[productId]` | sesión | `{ quantity }` | `CartItem[]` · **409** si `quantity > stock` |
| DELETE | `/api/cart/[productId]` | sesión | — | `CartItem[]` |

Rutas existentes; no se crea ninguna. Zod: `setQuantitySchema` (`quantity` int 1–99),
ya aplicado en el handler. Para 0 se usa `DELETE`, no `PATCH` con cero.

**Hueco verificado en el código.** `PATCH /api/cart/[productId]` no mira el stock:
`cartRepository.setQuantity()` escribe la cantidad tal cual (`src/server/repositories/cart.repository.ts:49-61`)
y el handler solo valida el rango 1–99 de Zod. El único 409 del módulo está en
`POST /api/cart` (`src/app/api/cart/route.ts:60-66`) y cubre otro caso: `stock <= 0`.
Zod no puede validar esto — el tope depende de una fila de `products`, no del payload.
Si el tope vive solo en el `max` del stepper, es una validación de cliente sola en un
borde de confianza. El PATCH lee el producto y responde 409 con el mismo criterio que
el POST: se valida el stock, no se reserva (la reserva sigue siendo problema de `orders`).

## Reutilizar
- `src/modules/cart/hooks/use-cart.ts` — `useCart`, `useAddToCart`, `useSetCartQuantity`, `useRemoveFromCart`. Sin hooks nuevos.
- `src/modules/cart/components/cart-drawer.tsx` — el control +/– de `CartRow` (líneas del bloque `Minus`/`Plus`) es el que se extrae: **no se escribe un segundo stepper**.
- `src/modules/cart/schemas/cart.schema.ts` — `MAX_QUANTITY`.
- `src/lib/api-error.ts` — `getApiErrorMessage`; `sonner` — `toast.error` (patrón ya usado en `add-to-cart-button.tsx`).
- `src/components/ui/button.tsx` — variantes `ghost` + `size="icon-xs"`, ya usadas por el stepper del drawer.
- `@clerk/nextjs` — `Show when="signed-in|signed-out"`, `SignInButton mode="modal"`.
- Sin componentes shadcn nuevos.

## Tareas
- [x] T1 — `<QuantityStepper quantity min max disabled onChange />` presentacional (sin hooks de datos), copiado tal cual del markup de `CartRow` · `src/modules/cart/components/quantity-stepper.tsx`
- [x] T2 — `CartRow` usa `QuantityStepper` con `min=1` y `max={Math.min(item.stock, MAX_QUANTITY)}`; comportamiento idéntico · `src/modules/cart/components/cart-drawer.tsx`
- [x] T3 — Sub-componente client con `useCart()` + `QuantityStepper` (`min=0`), montado **dentro** de `<Show when="signed-in">`; `onChange(0)` → `useRemoveFromCart`, resto → `useSetCartQuantity`; errores por `toast.error` · `src/modules/cart/components/add-to-cart-button.tsx`
- [x] T4 — En ese mismo archivo: si el ítem no está en el carrito, botón "Agregar" actual (abre el drawer en `onSuccess`); el `+`/`–` no toca el drawer · `src/modules/cart/components/add-to-cart-button.tsx`
- [x] T5 — `PATCH` lee el producto y responde 409 con el mismo criterio que el `POST`, separando los dos casos: `stock <= 0` → "El producto no tiene stock"; `quantity > stock` → "Solo quedan N unidades disponibles". El cliente lo muestra por toast (mismo `getApiErrorMessage`) · `src/app/api/cart/[productId]/route.ts`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- La rama signed-in tiene que ser **otro componente**, no un `if` dentro de `AddToCartButton`: los hooks corren aunque `Show` no pinte. Es el mismo motivo por el que `CartDrawer` está envuelto en `Show` en `src/app/(storefront)/layout.tsx`. Si `useCart()` se llama en el componente de arriba, cada card de un anónimo dispara un `GET /api/cart` 401 y rompe AC9.
- N cards con `useCart()` = una sola request: misma `queryKey`, TanStack deduplica. Nada de `useState` de cantidad — duplicarlo rompe AC7.
- Mientras `useCart()` está `isPending` se muestra "Agregar" habilitado: `POST /api/cart` **suma** (upsert `quantity + excluded`), así que un click antes de que llegue el carrito no pisa la cantidad real. Puede haber un flash botón → stepper en la primera carga; aceptado.
- `stock <= 0` se evalúa antes que todo lo demás: el early return de "Sin stock" no se mueve.
- El drawer se abre solo en el primer agregado. Abrirlo en cada `+` taparía el catálogo justo cuando el usuario está eligiendo cuántos lleva.
- El `max` del stepper y el 409 del PATCH no son redundantes: el primero es UX (el `+`
  se apaga antes de pedir algo imposible), el segundo es el que sostiene la regla cuando
  la petición no viene de la UI.
