---
id: 020
title: Rango de "Mis compras" en la zona horaria del cliente
status: done
module: orders
scope: client
---

# 020 — Rango de "Mis compras" en la zona horaria del cliente

Bugfix de la deuda que dejó anotada la spec 019 en "Notas": `from`/`to` llegan
como fecha sin hora y el handler las interpreta en UTC.

## Objetivo
Un cliente en cualquier zona horaria ve en "Mis compras" todas sus órdenes del
período elegido según SU calendario local, no el de UTC.

## Alcance
Incluye:
- Campo `tzOffset` (minutos, `Date.prototype.getTimezoneOffset()`) en la query de `GET /api/orders`.
- Cálculo de los bordes del rango desplazado por ese offset en el handler.

No incluye:
- Zona horaria persistida en el perfil o en `users`.
- Nombres IANA de zona (`America/Lima`) ni `Intl.DateTimeFormat` en el servidor.
- DST histórico: el offset es el de "ahora", no el del día de cada orden (ver Notas).
- Cambios en `order.repository.ts` (ya recibe `Date`, sigue igual).

## Criterios de aceptación
- [ ] AC1 — Dado un cliente en UTC-5 cuyo "hoy" local es 2026-09-09 y una orden `paid` con `created_at = 2026-09-10T02:14:17Z`, cuando carga "Mis compras" en "Mes actual", entonces esa orden aparece en el grupo del 09 de septiembre.
- [ ] AC2 — Dado un cliente en UTC+2, cuando filtra un rango custom `desde = hasta = 2026-09-09`, entonces solo se listan órdenes con `created_at` entre `2026-09-08T22:00:00Z` (inclusive) y `2026-09-09T22:00:00Z` (exclusivo).
- [ ] AC3 — Dado un request sin `tzOffset` (cliente viejo o llamada directa), entonces el handler responde 200 y se comporta como hoy (offset 0 = UTC), sin romper.
- [ ] AC4 — Dado `tzOffset` no numérico o fuera de `[-840, 840]`, entonces 400 con `{ error: "Rango inválido", issues }`, sin tocar la base.
- [ ] AC5 — Dado que el cliente cambia entre "Mes actual" y "Rango custom", entonces ambos modos mandan `tzOffset` y la queryKey de TanStack Query lo incluye (rangos de distinta zona no comparten caché).

## Datos
Sin cambios de esquema.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/orders?from&to&tzOffset` | sesión Clerk | — | `OrderWithItems[]` · 400 rango inválido · 401 sin sesión |

Zod: `orderRangeQuerySchema` (existente) suma `tzOffset` —
`z.coerce.number().int().min(-840).max(840).optional()`. Opcional, no `.default()`:
el tipo de salida `OrderRangeQuery` se sigue usando como estado parcial en el
cliente (`useState<OrderRangeQuery>({})`) y un `default` lo volvería requerido.
El fallback a `0` va en el handler. El `refine` de `from <= to` no cambia.

Semántica del offset: la de `getTimezoneOffset()` (positivo al oeste de UTC,
UTC-5 → `300`). Borde inferior = `Date.parse(from + "T00:00:00Z") + tzOffset*60000`;
borde superior = mismo cálculo sobre `to` + 1 día (exclusivo, como hoy).

## Reutilizar
- `src/server/repositories/order.repository.ts` → `listByUser(userId, { from, to })` — tal cual, ya recibe `Date`.
- `src/modules/orders/services/order.service.ts` → `listOrders` pasa `params: range`: el campo nuevo viaja solo, no se toca el archivo.
- `src/modules/orders/hooks/use-orders.ts` → `ordersKey(range)` serializa el objeto entero: `tzOffset` entra en la key solo, no se toca el archivo.
- `src/modules/orders/components/purchases-section.tsx` → `toDateInput()` y `currentMonthRange()` ya existen; se extienden, no se reescriben.
- `src/lib/auth.ts` → `requireSessionUser()` sin cambios.

Sin componentes shadcn nuevos.

## Tareas
- [x] T1 — Agregar `tzOffset` opcional (`coerce.number().int()`, rango `[-840, 840]`) a `orderRangeQuerySchema` · `src/modules/orders/schemas/order.schema.ts`
- [x] T2 — Reemplazar `startOfDayUtc(date)` por un helper que sume `tzOffset*60000` y usarlo en ambos bordes, con fallback `?? 0` · `src/app/api/orders/route.ts`
- [x] T3 — Incluir `tzOffset: new Date().getTimezoneOffset()` en `currentMonthRange()` y en el estado inicial de `custom` (modo rango custom) · `src/modules/orders/components/purchases-section.tsx`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- Con `to` en el futuro (fin de mes) el borde superior queda adelantado: no cambia nada, solo amplía el rango.
- El offset es el actual del navegador; una orden creada bajo otro DST puede caer en el día vecino. Aceptado: el proyecto no maneja zonas con DST en producción.
- No hay cliente móvil ni integración externa consumiendo `/api/orders`, por eso el campo puede entrar sin versionar el endpoint (verificado: `listOrders` es el único consumidor).
