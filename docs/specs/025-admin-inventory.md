---
id: 025
title: Inventario y reposición
status: done
module: products
scope: admin
---

# 025 — Inventario y reposición

## Contexto
Tercero de los cuatro specs de admin (023 dashboard `done`, 024 pedidos `done`,
026 finanzas pendiente). 023 dejó `reorder_point` afuera a propósito y usó
`LOW_STOCK_THRESHOLD = 5` (`product.repository.ts:164`, con el comentario que
apunta a este spec). Acá entra la columna real por producto y la vista que la
usa.

## Objetivo
Quien tenga `inventory.read` ve qué productos hay que reponer según el punto de
reposición de cada uno, y con `inventory.adjust` registra la entrada de stock.

## Alcance
Incluye: columna `reorder_point` por producto (migración); `/admin/inventory`
con tabla, buscador y filtro "solo por reponer"; ajuste de stock por **delta**
(entrada/merma) y edición del punto de reposición, auditados; el KPI "Stock
bajo" del dashboard pasa a usar la columna.
No incluye: historial de movimientos de stock en tabla propia (`audit_logs`
alcanza); reserva de stock al agregar al carrito; descuento automático de stock
al pagar; alertas por email; proveedores ni órdenes de compra; CSV.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario con `inventory.read`, cuando abre `/admin/inventory`, entonces ve todos los productos con SKU, categoría, stock, punto de reposición y un badge "Reponer" cuando `stock <= reorder_point`.
- [ ] AC2 — Dado que se activa "Solo por reponer", entonces quedan solo las filas con `stock <= reorder_point`; el orden por defecto ya pone esas filas primero y dentro de ellas el stock más bajo arriba.
- [ ] AC3 — Dado un producto con stock 3 y se registra una entrada de +10, entonces la fila muestra 13 sin recargar y el diálogo se cierra.
- [ ] AC4 — Dado un producto con stock 3 y se registra −10, entonces la API responde `409` con mensaje de stock insuficiente y el stock no cambia.
- [ ] AC5 — Dado un ajuste aplicado, entonces `audit_logs` tiene una fila `product.stock_adjusted` con `entityId` del producto, `changes.stock = {from, to}` y `metadata.delta`, escrita en la misma transacción que el `UPDATE`.
- [ ] AC6 — Dado que se cambia el punto de reposición de 5 a 20, entonces queda persistido, la fila pasa a "Reponer" si corresponde y hay auditoría `product.reorder_point_updated`.
- [ ] AC7 — Dado un usuario con `inventory.read` pero sin `inventory.adjust`, entonces no ve el botón de ajuste y el `PATCH` responde `403`. Sin `inventory.read`, el nav no muestra "Inventario", la página termina en `/sin-acceso` y el `GET` responde `403`.
- [ ] AC8 — Dado `{"delta": 0}`, `{"delta": 1.5}`, `{}` o un id que no es uuid, entonces la respuesta es `400 {"error":…, issues:[…]}`; un producto inexistente da `404`.
- [ ] AC9 — Dado el KPI "Stock bajo (actual)" del dashboard, entonces cuenta productos activos con `stock <= reorder_point` (no contra la constante 5).

## Datos
`products` · `reorder_point` · `integer NOT NULL DEFAULT 5` · **requiere
migración** (`npm run db:generate` + `db:migrate`). El default 5 es el valor de
`LOW_STOCK_THRESHOLD`: las filas existentes conservan el comportamiento de 023 y
la constante se borra. Sin índice nuevo: la comparación es entre dos columnas de
la misma fila y la tabla es de tamaño de catálogo.

`permissions` · dos filas nuevas del catálogo (`inventory.read`,
`inventory.adjust`), sembradas por `npm run db:seed`.

## API
| Método | Ruta | Permiso | Body/Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/inventory` | `inventory.read` | `inventoryQuerySchema` | `200 InventoryRow[]` · `400` · `403` · `500` |
| PATCH | `/api/admin/inventory/[id]` | `inventory.adjust` | `adjustInventorySchema` | `200 InventoryRow` · `400` · `403` · `404` · `409` · `500` |

`InventoryRow = { id, name, sku, categoryName, stock, reorderPoint, isActive }`.

Zod en `src/modules/products/schemas/inventory.schema.ts` (archivo nuevo: el de
productos ya tiene seis schemas):
- `inventoryQuerySchema`: `onlyLow?` (`z.stringbool()`), `search?`
  (`z.string().trim().max(80)`), `category?` (`z.uuid()`).
- `adjustInventorySchema`: `delta?` (`int`, `!== 0`, `abs <= 100000`),
  `reorderPoint?` (`int`, `0..100000`); refine "al menos uno" como
  `updateProductSchema`.

Sin paginación de servidor: la lista es de tamaño de catálogo y `DataTable`
pagina en cliente. `src/lib/cursor.ts` **no** se usa acá (a diferencia de 024).

## Reutilizar
- `src/server/repositories/product.repository.ts` — `listColumns`, `countLowStock`, patrón de `SQL[]`; las dos funciones nuevas van acá, no en un repo nuevo.
- `src/modules/products/components/products-table.tsx` — patrón completo de tabla del panel: `createColumnHelper` + `tableShellFeatures` + `<DataTable>` + filtros locales con `useState`. Copiar la forma, no el contenido.
- `src/components/shared/data-table.tsx` — `DataTable` y `tableShellFeatures` tal cual.
- `src/modules/products/components/product-form-dialog.tsx` — patrón de diálogo con React Hook Form + `zodResolver` + `toast`.
- `src/lib/audit.ts` (`logAudit`, exige `tx`), `src/server/db` (`db.transaction`, tipo `Tx`) — ver `order.repository.ts:62` como plantilla de "mutación + traza en una transacción".
- `src/lib/permissions.ts` (`requirePermission`, `guard.user?.id` como `actorId`), `src/lib/auth.ts` (`requirePanelAccess`), `src/lib/rbac-catalog.ts` (catálogo y semilla de la matriz).
- `src/lib/axios.ts` + `src/lib/api-error.ts` — patrón de service; `src/modules/products/hooks/use-products.ts` — patrón de hook + `invalidateQueries`.
- `src/app/(admin)/admin/layout.tsx` — `NAV_ITEMS` con `permission`.
- `src/components/ui/{table,badge,button,input,select,dialog,label,field,skeleton,sonner}.tsx` ya instalados. Checkbox para "Solo por reponer" también (`checkbox.tsx`). **No hay que instalar nada.**
- `proxy.ts` — `/api/admin(.*)` y `/admin(.*)` ya están cubiertos; no se toca.

## Tareas
- [x] T1 — Columna `reorderPoint` (`integer notNull default 5`) y migración generada · `src/server/db/schema/product.ts`, `drizzle/` · verif: `npm run db:generate && npm run typecheck`
- [x] T2 — Alta de `inventory.read` / `inventory.adjust` en `PERMISSIONS` y en `ROLE_PERMISSIONS` (admin y manager: las dos; employee y audit: solo `read`) · `src/lib/rbac-catalog.ts` · verif: `npm run check:rbac`
- [x] T3 — `listInventory(filters)`; `countLowStock` pasa a `stock <= reorder_point` y se borra `LOW_STOCK_THRESHOLD`; `reorderPoint` sumado a `listColumns` · `src/server/repositories/product.repository.ts` · verif: `npm run typecheck`
- [x] T4 — `adjustStock({ id, delta, reorderPoint, actorId })`: `db.transaction`, `UPDATE … SET stock = stock + $delta WHERE id = $id AND stock + $delta >= 0 RETURNING`, `logAudit` por cada cambio, distingue "no existe" de "stock insuficiente" · `src/server/repositories/product.repository.ts` · verif: `npm run typecheck`
- [x] T5 — `inventoryQuerySchema`, `adjustInventorySchema` y tipos `InventoryRow` / `AdjustInventoryInput` · `src/modules/products/schemas/inventory.schema.ts`, `src/modules/products/types/product.ts` · verif: `npm run typecheck`
- [x] T6 — `GET` con `requirePermission("inventory.read")` → `safeParse` de `searchParams` → repo; ningún otro método exportado · `src/app/api/admin/inventory/route.ts` · verif: `npm run lint`
- [x] T7 — `PATCH` con `requirePermission("inventory.adjust")` → `productIdSchema` + `adjustInventorySchema` → `adjustStock`; mapea insuficiente→`409`, inexistente→`404` · `src/app/api/admin/inventory/[id]/route.ts` · verif: `npm run lint`
- [x] T8 — `listInventory(query)` y `adjustInventory(id, input)` con `BASE_URL="/admin/inventory"` · `src/modules/products/services/inventory.service.ts` · verif: `npm run typecheck`
- [x] T9 — `inventoryKey` + `useInventory(filters)` + `useAdjustInventory()` (invalida `inventoryKey` y `productsKey`) · `src/modules/products/hooks/use-inventory.ts` · verif: `npm run lint`
- [x] T10 — Diálogo de ajuste: entrada/merma (`delta`) y punto de reposición, con stock resultante visible y error de servidor mostrado · `src/modules/products/components/adjust-stock-dialog.tsx` · verif: `npm run lint`
- [x] T11 — Tabla de inventario: columnas, badge "Reponer", buscador, filtro "Solo por reponer", botón de ajuste solo si `canAdjust`; carga/error/vacío · `src/modules/products/components/inventory-table.tsx` · verif: `npm run lint`
- [x] T12 — Page con guard `inventory.read` → `/sin-acceso`, pasa `canAdjust` desde el server, e item "Inventario" en `NAV_ITEMS` · `src/app/(admin)/admin/inventory/page.tsx`, `src/app/(admin)/admin/layout.tsx` · verif: `npm run build`
- [ ] T13 — **PAUSA: validación humana.** `npm run db:migrate && npm run db:seed`, después recorrer AC1–AC9 con sesiones `admin`, `employee` y `manager`.

Verificación final: `npm run check:rbac && npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- El ajuste es un **delta aplicado en SQL** (`stock = stock + $delta`), no un
  read-modify-write: dos reposiciones concurrentes suman, no se pisan. El guard
  de no-negativo va en el `WHERE` por el mismo motivo; cero filas devueltas = o
  no existe o no alcanza el stock, y el repo distingue los dos casos con una
  lectura posterior.
- Los permisos nuevos no existen en la base hasta correr `npm run db:seed`
  (siembra con `onConflictDoNothing`). Hasta entonces nadie salvo el Dueño
  (`super_admin` = `"*"`) ve la sección: es lo esperado, no un bug.
- `products.update` sigue permitiendo editar `stock` desde el formulario de
  producto **sin** auditoría. Queda así: unificar los dos caminos es refactor de
  otro spec, no de este.
