---
id: 023
title: Dashboard de métricas del panel admin
status: approved
module: dashboard
scope: admin
---

# 023 — Dashboard de métricas del panel admin

Primero de cuatro specs de admin (024 órdenes, 025 inventario, 026 finanzas).
Hoy `/admin` es 404: solo existe `layout.tsx`. Este spec ocupa ese hueco.

## Objetivo
Un administrador con `dashboard.read` entra a `/admin` y ve KPIs de ventas y tres
gráficos del período elegido (7/30/90 días) en su zona horaria local.

## Alcance
Incluye:
- `src/app/(admin)/admin/page.tsx` + entrada "Dashboard" en el nav del layout.
- `GET /api/admin/metrics?range&tzOffset` — endpoint único, 5 queries en un `Promise.all`.
- Las 4 queries de órdenes viven en `order.repository.ts` (el spec 024 las reusa).
- Selector de rango con presets, skeleton de carga y card de error con reintento.

No incluye:
- SSE / tiempo real (hay `refetchInterval` de 30 s y basta).
- Rango de fechas a medida, export CSV, comparación contra el período anterior.
- `reorder_point` por producto (spec 025) y todo lo de los specs 024/025/026.
- Zustand: el rango es `useState` de un componente.

## Criterios de aceptación
- [ ] AC1 — Dado un admin con `dashboard.read`, cuando entra a `/admin`, entonces ve 4 KPIs (ingresos, pedidos, ticket promedio, productos con stock bajo) del rango activo, con importes formateados desde centavos.
- [ ] AC2 — Dado el rango por defecto (30d), cuando cambia a 7d o 90d, entonces se refetchea con una queryKey distinta y los tres gráficos se actualizan.
- [ ] AC3 — Dado un rango con días sin ventas, entonces "Ingresos por día" muestra N puntos consecutivos y ordenados (los huecos valen 0), no solo los días con ventas.
- [ ] AC4 — Dado un cliente en UTC-5 (`tzOffset=300`), entonces los bordes del rango y el agrupado por día usan su calendario local, no UTC.
- [ ] AC5 — Dado un request sin `tzOffset`, entonces responde 200 y se comporta como UTC (offset 0), sin romper.
- [ ] AC6 — Dado `range` fuera de `7d|30d|90d` o `tzOffset` fuera de `[-840, 840]`, entonces 400 con `{ error, issues }` sin tocar la base.
- [ ] AC7 — Dado un usuario sin `dashboard.read`, entonces `/admin` redirige a `/sin-acceso` (guard del layout) y el endpoint responde 403.
- [ ] AC8 — Dado que la query está cargando, se ven skeletons; dado que falla, se ve una card de error con botón "Reintentar" que dispara `refetch()`.
- [ ] AC9 — Dado que el admin está en `/admin/products`, entonces el nav resalta solo "Productos", no también "Dashboard".
- [ ] AC10 — Dado el árbol de `/admin`, entonces hay un solo `"use client"` y está en `metrics-view.tsx`.

## Datos
Sin cambios de esquema. Cero migraciones. Solo lectura sobre `orders`,
`order_items` y `products`. Umbral de stock bajo: constante
`LOW_STOCK_THRESHOLD = 5` en `product.repository.ts` (no hay columna).

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/metrics?range&tzOffset` | `requirePermission("dashboard.read")` | — | `DashboardMetrics` · 400 inválido · 401/403 guard · 500 |

Zod `metricsQuerySchema`: `range` enum `7d|30d|90d` con `.default("30d")`;
`tzOffset` `z.coerce.number().int().min(-840).max(840).optional()`, fallback `?? 0`
en el handler. Semántica de `getTimezoneOffset()` (positivo al oeste, UTC-5 → 300),
igual que el spec 020: borde = instante UTC + `tzOffset * 60_000`.

`DashboardMetrics`:
`kpis { revenue, orders, averageTicket, lowStock }` (revenue y averageTicket en
CENTAVOS) · `revenueByDay { date: "2026-09-16", revenue }[]` ·
`topProducts { productId, name, quantity, revenue }[]` (top 5) ·
`ordersByStatus { status, count }[]`.

## Reutilizar
- `src/app/api/admin/audit-logs/route.ts` — patrón exacto del handler: `requirePermission` → `safeParse(Object.fromEntries(searchParams))` → 400 con `issues` → try/catch 500.
- `src/lib/permissions.ts` → `requirePermission(code)` devuelve `{ ok, response }`.
- `src/app/(admin)/admin/layout.tsx` — `requirePanelAccess()` ya exige `dashboard.read`: la página no lleva guard propio.
- `src/server/repositories/order.repository.ts` — ahí van las 4 queries nuevas; ya importa `and/eq/gte/lt/sql` y la constante `PURCHASED = ["paid","fulfilled"]`.
- `src/server/repositories/product.repository.ts` — ahí va `countLowStock()`.
- `src/lib/axios.ts` → `api` (baseURL `/api`), como `audit-log.service.ts`.
- `src/lib/money.ts` — formateo de centavos, no reimplementar.
- `src/modules/audit/hooks/use-audit-logs.ts` — patrón de queryKey con filtros.
- `src/modules/orders/schemas/__tests__/order.schema.test.ts` — patrón de test (`node:test` + `assert/strict`, se corre con `npm test`).
- `src/components/ui/`: `card`, `tabs`, `skeleton`, `badge`, `separator` ya instalados.
- Falta el wrapper de gráficos: `npx shadcn@latest add chart` (Recharts 3.10.1 ya está en `package.json`; prohibido Recharts crudo por §6 del CLAUDE.md).

## Tareas
- [ ] T1 — `metricsQuerySchema` (range enum con default, tzOffset opcional) · `src/modules/dashboard/schemas/metrics.schema.ts`
- [ ] T2 — Tipos `DashboardMetrics`, `MetricsRange` y sus 4 sub-tipos · `src/modules/dashboard/types/metrics.ts`
- [ ] T3 — `getSalesKpis(range)`: `sum(total_amount)` + `count` sobre `orders` con status IN `PURCHASED` dentro del rango · `src/server/repositories/order.repository.ts`
- [ ] T4 — `getRevenueByDay(range, tzOffset)`: GROUP BY `date_trunc('day', created_at - make_interval(mins => tzOffset))`, ORDER BY día, sin `generate_series` · `src/server/repositories/order.repository.ts`
- [ ] T5 — `getTopProducts(range)`: JOIN `order_items` → `orders`, GROUP BY producto, ORDER BY cantidad DESC, LIMIT 5 · `src/server/repositories/order.repository.ts`
- [ ] T6 — `getOrdersByStatus(range)`: GROUP BY `status` dentro del rango, sin filtrar por status · `src/server/repositories/order.repository.ts`
- [ ] T7 — `LOW_STOCK_THRESHOLD = 5` y `countLowStock()` (`stock <= threshold AND is_active`) · `src/server/repositories/product.repository.ts`
- [ ] T8 — `fillDays(from, days, rows)`: función pura que rellena los días sin ventas con `revenue: 0` y devuelve la serie consecutiva y ordenada · `src/modules/dashboard/lib/revenue-series.ts`
- [ ] T9 — Test de `fillDays`: entra un rango con huecos, salen N puntos consecutivos y ordenados · `src/modules/dashboard/lib/__tests__/revenue-series.test.ts`
- [ ] T10 — Route handler GET: guard, parseo, bordes del rango con `tzOffset`, `Promise.all` de las 5 queries, `averageTicket` derivado (0 si no hay pedidos) y `fillDays` · `src/app/api/admin/metrics/route.ts`
- [ ] T11 — `getMetrics({ range, tzOffset })` con `api.get` y `params` · `src/modules/dashboard/services/metrics.service.ts`
- [ ] T12 — `useMetrics(range)`: `useQuery` con `refetchInterval: 30_000` y `range` + `tzOffset` en la queryKey · `src/modules/dashboard/hooks/use-metrics.ts`
- [ ] T13 — `npx shadcn@latest add chart` · `src/components/ui/chart.tsx`
- [ ] T14 — `KpiCards` (4 cards, importes vía `money.ts`) · `src/modules/dashboard/components/kpi-cards.tsx`
- [ ] T15 — `RevenueChart` (área/línea) con `ChartContainer` · `src/modules/dashboard/components/revenue-chart.tsx`
- [ ] T16 — `TopProductsChart` (barras) · `src/modules/dashboard/components/top-products-chart.tsx`
- [ ] T17 — `OrdersStatusChart` (dona) · `src/modules/dashboard/components/orders-status-chart.tsx`
- [ ] T18 — `MetricsView`: único `"use client"`, `useState` del rango, `Tabs` 7/30/90, skeletons y card de error con "Reintentar" · `src/modules/dashboard/components/metrics-view.tsx`
- [ ] T19 — `page.tsx` Server Component: título + `<MetricsView />` · `src/app/(admin)/admin/page.tsx`
- [ ] T20 — Agregar `{ href: "/admin", label: "Dashboard", permission: "dashboard.read" }` al inicio de `NAV_ITEMS` · `src/app/(admin)/admin/layout.tsx`
- [ ] T21 — Corregir el activo: `pathname.startsWith(href)` deja `/admin` siempre resaltado; usar match exacto salvo para las subrutas · `src/components/shared/admin-nav.tsx`

Verificación final: `npm run typecheck && npm run lint && npm test`

## Notas
- El `sum()` de Drizzle devuelve `string | null` en Postgres (numeric): castear a
  entero y tratar el `null` (rango sin ventas) como `0`, no como `NaN`.
- `topProducts` agrupa por `order_items.product_id` con el `name` snapshot de la
  línea: un producto borrado sigue apareciendo con su nombre de compra.
- `AdminNav` marca el activo con `pathname.startsWith(href)` (verificado): al
  entrar `/admin`, prefijo de todo el panel, queda siempre resaltado. Por eso T21.
