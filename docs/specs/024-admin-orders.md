---
id: 024
title: Pedidos del panel
status: in-review
module: orders
scope: admin
---

# 024 — Pedidos del panel

## Contexto
Segundo de los cuatro specs de admin (023 dashboard `done`, 025 inventario, 026
finanzas). El dashboard muestra agregados; falta el detalle fila por fila. Las
queries de órdenes ya viven en `order.repository.ts` (023 §Decisiones) y este
spec suma **una** función de listado ahí, reusando `rangeConditions` y `PURCHASED`.
Solo lectura: la instrucción original dice "órdenes con filtros". `orders.update_status`
y `orders.delete` existen en el catálogo RBAC pero **no se usan acá**.

## Objetivo
Quien tenga `orders.read` abre `/admin/orders`, filtra los pedidos por rango de
fechas, estado y cliente, y pagina sin ver duplicados.

## Alcance
Incluye: `GET /api/admin/orders` paginado por cursor; `listForAdmin` en el
repositorio existente; página con guard e item de nav; tres extracciones de
tercera repetición (etiquetas de estado, cursor keyset, rango de fechas).
No incluye: cambiar estado, cancelar o borrar pedidos; detalle de ítems por
pedido (no hay vista de detalle, no hay N+1); exportar CSV; reembolsos;
auditar nada (no hay mutación que auditar).

## Criterios de aceptación
- [x] AC1 — Dado un usuario con `orders.read`, cuando abre `/admin/orders`, entonces ve los 50 pedidos más recientes (`created_at desc, id desc`) con fecha local, cliente, estado, total formateado y moneda.
- [x] AC2 — Dado el filtro Estado en "Fallido", cuando se aplica, entonces solo quedan filas `failed`; a diferencia del historial del cliente, acá sí se listan `pending`/`failed`/`expired`.
- [x] AC3 — Dado Desde 2026-01-01 / Hasta 2026-01-31, cuando se aplica, entonces entran los pedidos del 31 completo en hora local del navegador y ninguno de febrero (mismo criterio de `tzOffset` que `GET /api/orders`, spec 020).
- [x] AC4 — Dado el buscador de cliente con "ana", cuando se aplica (debounce), entonces quedan solo los pedidos de usuarios cuyo email, nombre o apellido contiene "ana", sin distinguir mayúsculas.
- [x] AC5 — Dado que hay 120 pedidos y se pulsa "Cargar más" dos veces, entonces se ven 150 filas sin repetidas ni saltos, y el botón desaparece cuando `nextCursor` es `null`.
- [x] AC6 — Dado un badge de estado, entonces el color sigue la valencia de 023: verde `paid`/`fulfilled`, rojo `failed`, ámbar `expired`, gris `pending`; y la etiqueta en texto acompaña siempre al color.
- [x] AC7 — Dado un `manager` sin `orders.read`, cuando entra al panel, entonces el nav no muestra "Pedidos", `/admin/orders` termina en `/sin-acceso` y el endpoint responde `403`. Un `POST` al endpoint responde `405`.
- [x] AC8 — Dado `?limit=500`, `?status=cancelado` o un `cursor` mal formado, entonces la respuesta es `400 {"error":…, issues:[…]}`.

## Datos
**Sin cambios de esquema. Sin migración.** `orders_status_idx` cubre el filtro
por estado; `orders_user_created_at_idx` no sirve acá (empieza por `user_id`),
así que el orden global sale de un sort sobre el resultado filtrado. A escala de
panel alcanza; ver Notas.

## API
| Método | Ruta | Permiso | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/orders` | `orders.read` | `listAdminOrdersQuerySchema` | `200 AdminOrdersPage` · `400` · `403` · `500` |

`AdminOrdersPage = { items: AdminOrderRow[]; nextCursor: string | null }`
`AdminOrderRow = Order & { customer: { id, email, firstName, lastName } }`
(sin `stripeCheckoutSessionId`/`stripePaymentIntentId` en el `select`: son ids de
pasarela que esta vista no muestra).

Zod en `src/modules/orders/schemas/order.schema.ts` (mismo archivo que
`orderRangeQuerySchema`, no uno nuevo): `listAdminOrdersQuerySchema` con
`from?`/`to?` (`z.iso.date()`), `tzOffset?`, `status?` (`z.enum` de los 5 valores
de `orderStatus`), `search?` (`z.string().trim().max(120)`),
`limit?` (`coerce.number().int().min(1).max(100).default(50)`), `cursor?`
(mismo formato `"<ISO>|<uuid>"` de 009, parseado por el helper compartido).

## Reutilizar
- `src/server/repositories/order.repository.ts` — `rangeConditions()` y `OrderRange` tal cual; `listForAdmin` se suma ahí, no en un repo nuevo.
- `src/modules/audit/lib/cursor.ts` — `parseCursor` ya implementa el keyset `"<ISO>|<uuid>"` con sus tests; se **mueve** a `src/lib/cursor.ts` (T1) para no acoplar orders → audit.
- `src/app/api/orders/route.ts` — `startOfDay` + `DAY_MS` con `tzOffset`; tercera repetición junto con `audit-logs/route.ts` → se extrae (T2).
- `src/modules/dashboard/components/orders-status-chart.tsx` — su `STATUS_LABEL` y el criterio de valencia documentado ahí; tercera repetición con `order-detail-dialog.tsx` → se extrae (T3). La paleta hex del gráfico **se queda en el gráfico**: el badge usa clases Tailwind, no vars de Recharts.
- `src/server/repositories/user.repository.ts:list` — patrón `ilike` sobre email/firstName/lastName para el filtro de cliente.
- `src/modules/audit/{services,hooks,components}/**` — patrón completo de listado por cursor: `useInfiniteQuery`, barra de filtros controlada, tabla con estados de carga/error/vacío y "Cargar más".
- `src/lib/money.ts` (`formatPrice`), `src/hooks/use-debounced-value.ts`, `src/lib/permissions.ts` (`requirePermission`, `can`), `src/lib/auth.ts` (`requirePanelAccess`).
- `src/components/ui/{table,badge,button,select,input,skeleton}.tsx` — instalados. Fechas con `<Input type="date">` nativo. **No hay que instalar nada.**
- `src/components/shared/data-table.tsx` **no se usa**: pagina en cliente (`rowPaginationFeature`) y acá la paginación es de servidor — mismo motivo que 009 §4.

## Tareas
- [x] T1 — Mover `parseCursor` a `src/lib/cursor.ts` (tipo `KeysetCursor`) y actualizar sus 3 importadores · `src/lib/cursor.ts`, `src/modules/audit/{lib,schemas}/**`, `src/server/repositories/audit-log.repository.ts` · verif: `npm run check:audit`
- [x] T2 — `toDateRange(from?, to?, tzOffset = 0): OrderRange` (día completo local, "hasta" inclusivo) y migrar los dos handlers que hoy lo tienen inline · `src/lib/date-range.ts`, `src/app/api/orders/route.ts`, `src/app/api/admin/audit-logs/route.ts` · verif: `npm run typecheck`
- [x] T3 — `ORDER_STATUS_LABEL` + `ORDER_STATUS_BADGE` (clase Tailwind por valencia) y migrar los dos consumidores actuales · `src/lib/order-status.ts`, `src/modules/orders/components/order-detail-dialog.tsx`, `src/modules/dashboard/components/orders-status-chart.tsx` · verif: `npm run lint`
- [x] T4 — `listForAdmin(params): Promise<{ items, nextCursor }>` — `innerJoin` a `users`, condiciones en `SQL[]`, keyset, `limit+1` · `src/server/repositories/order.repository.ts` · verif: `npm run typecheck`
- [x] T5 — `listAdminOrdersQuerySchema` + tipos `AdminOrderRow`/`AdminOrdersPage`/`AdminOrderFilters` · `src/modules/orders/schemas/order.schema.ts`, `src/modules/orders/types/order.ts` · verif: `npm run typecheck`
- [x] T6 — `GET` con `requirePermission("orders.read")` → `safeParse` → `toDateRange` → repo; ningún otro método exportado · `src/app/api/admin/orders/route.ts` · verif: `npm run typecheck && npm run lint`
- [x] T7 — `listAdminOrders(query)` con `BASE_URL="/admin/orders"` · `src/modules/orders/services/admin-order.service.ts` · verif: `npm run typecheck`
- [x] T8 — `adminOrdersKey` + `useAdminOrders(filters)` con `useInfiniteQuery` · `src/modules/orders/hooks/use-admin-orders.ts` · verif: `npm run lint`
- [x] T9 — Barra de filtros controlada: Desde/Hasta, Estado (`<Select>` desde `ORDER_STATUS_LABEL` + "Todos"), Cliente (`<Input>` + `useDebouncedValue`), Limpiar · `src/modules/orders/components/admin-orders-filters.tsx` · verif: `npm run lint`
- [x] T10 — Tabla: fecha local, cliente (nombre + email), badge de estado, total con `formatPrice`; carga/error/vacío y "Cargar más" · `src/modules/orders/components/admin-orders-table.tsx` · verif: `npm run lint`
- [x] T11 — Page con guard `orders.read` → `/sin-acceso` e item "Pedidos" en `NAV_ITEMS` · `src/app/(admin)/admin/orders/page.tsx`, `src/app/(admin)/admin/layout.tsx` · verif: `npm run build`
- [x] T12 — **PAUSA: validación humana.** Con `npm run dev` y datos sembrados, recorrer AC1–AC8 con sesiones `admin` y `manager`.

Verificación final: `npm run check:audit && npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- T1–T3 tocan código ya entregado (009 in-review, 023 done). Son extracciones sin
  cambio de comportamiento salvo uno visible: el diálogo del cliente pasa de
  "Pago confirmado" a "Pagado". Se acepta — el vocabulario queda unificado.
- Sin índice `(created_at desc, id desc)`: hoy el orden global sale de un sort.
  Se agrega cuando `EXPLAIN` lo pida, no antes.
- Filas nuevas durante el paginado no aparecen hasta refrescar: el cursor mira
  hacia atrás. Es lo correcto (no duplica ni saltea, AC5).
