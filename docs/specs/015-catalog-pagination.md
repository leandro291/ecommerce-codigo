---
id: 015
title: Paginación del catálogo
status: done
module: products
scope: client
---

# 015 — Paginación del catálogo

## Objetivo
Un visitante recorre `/products` en páginas de 12 productos con controles numerados,
en vez de una grilla única que crece sin fin.

## Alcance
Incluye:
- `page` en `publicProductQuerySchema` + `offset` en `listPublic` + `countPublic` real.
- Controles numerados (1 2 3 … Siguiente) debajo de la grilla, en la columna derecha.
- Contador de resultados con el total filtrado, no con lo que entró en la página.

No incluye:
- Infinite scroll ni "cargar más": la paginación es por URL, compartible y sin JS.
- Selector de productos por página: 12 fijo.
- Paginación en `/api/products` para el autocompletado (sigue pidiendo `limit=5`, sin `page`).

## Decisiones del usuario
- Tamaño de página: **12**.
- Controles: **números de página**, no solo Anterior/Siguiente.

## Criterios de aceptación
- [x] AC1 — Dado el catálogo con 25 productos activos cuando cargo `/products` entonces veo 12 productos y controles con 3 páginas, la 1 marcada `aria-current="page"`.
- [x] AC2 — Dado que hago clic en "2" entonces la URL pasa a `/products?page=2`, veo los productos 13–24 y los filtros vigentes se conservan.
- [x] AC3 — Dado `/products?category=notebooks&page=2` cuando hago clic en otra categoría, cambio el orden o envío una búsqueda entonces la URL resultante no lleva `page` (vuelvo a la página 1).
- [x] AC4 — Dado `?page=999` entonces veo la última página válida con contenido, nunca una grilla vacía.
- [x] AC5 — Dado `?page=0`, `?page=-1` o `?page=abc` entonces veo la página 1 **y los demás filtros de la URL siguen aplicados** (no cae todo a `DEFAULT_QUERY`).
- [x] AC6 — Dado un filtro cuyo resultado entra en una sola página entonces no se renderizan los controles de paginación.
- [x] AC7 — Dado `?category=notebooks` entonces el contador y el total de páginas cuentan solo esa categoría, no el catálogo completo.
- [x] AC8 — Dado que escribo en el buscador entonces el autocompletado sigue devolviendo sus 5 sugerencias (`GET /api/products?limit=5`, sin `page`).

## Datos
Sin cambios de esquema. Sin migración.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/products?...&page=N` | pública | — | `ProductListItem[]` (sin cambios de forma) |

Zod — `publicProductQuerySchema`: se agrega
`page` = coerce number, entero, mínimo 1, con `.catch(1)`.
`.catch(1)` cubre ausente y basura en un solo lugar; no lleva `.default`.
`src/app/api/products/route.ts` **no se toca**: ya pasa `parsed.data` completo a `listPublic`.

## Reutilizar
- `src/server/repositories/product.repository.ts` — `listPublic()` ya arma las `conditions` (isActive, featured, category, search); el conteo reusa esas mismas condiciones extraídas a un helper local, no las duplica.
- `src/modules/products/lib/catalog-href.ts` — único armador de URLs del catálogo; se extiende con un segundo argumento `page`, sin tocar `CatalogQuery` (así los chips y `SortSelect`, que hacen `catalogHref({...query, ...})`, siguen emitiendo URLs sin `page` → AC3 sale gratis).
- `src/modules/products/components/catalog-toolbar.tsx` — el form GET ya no emite `page`; **sin cambios** (AC3 para búsqueda).
- `src/modules/products/components/category-filters.tsx` — patrón `aria-current="page"` + clases `CHIP/CHIP_ACTIVE/CHIP_IDLE` a copiar en los controles de paginación.
- `src/app/(storefront)/products/page.tsx` — `CATALOG_LIMIT = 48` y su comentario ("si algún día lo supera, acá entran paginación y un COUNT(*) real") se reemplazan; ese día es hoy.
- Falta el componente: `npx shadcn@latest add pagination`.

## Tareas
- [x] T1 — Agregar `page` (coerce int min 1 `.catch(1)`) · `src/modules/products/schemas/product.schema.ts`
- [x] T2 — Extraer `buildPublicConditions(filters)` y aplicar `.offset((page - 1) * limit)` en `listPublic` · `src/server/repositories/product.repository.ts`
- [x] T3 — `countPublic(filters)`: `count()` sobre el mismo JOIN + mismas condiciones, devuelve `number` · `src/server/repositories/product.repository.ts`
- [x] T4 — `catalogHref(query, page?)`: escribe `page` solo si `page > 1` · `src/modules/products/lib/catalog-href.ts`
- [x] T5 — Instalar el componente base · `npx shadcn@latest add pagination`
- [x] T6 — `<CatalogPagination currentPage totalPages query />` (Server Component, `<Link>`, `aria-label="Ir a la página N"`, `aria-current="page"` en la activa, devuelve `null` si `totalPages <= 1`) · `src/modules/products/components/catalog-pagination.tsx`
- [x] T7 — Página: `PAGE_SIZE = 12`, `Promise.all([countPublic, categories])` → clamp de `page` a `[1, totalPages]` → `listPublic`, contador con el total, `<CatalogPagination>` debajo de la grilla · `src/app/(storefront)/products/page.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Desvíos de implementación

### D1 — `pagination.tsx` venía importando `cn` de un paquete npm
`npx shadcn@latest add pagination` (estilo `base-nova`) generó el archivo con
`import { cn } from "cn"` e instaló el paquete `cn` de npm, ajeno al proyecto.
El alias de `components.json` es `@/lib/utils` y los otros 16 componentes de
`src/components/ui/` importan de ahí. Se corrigió el import y se desinstaló el
paquete (`npm uninstall cn`); `package.json` queda sin esa dependencia.

### D2 — `PaginationLink` no se usa: los números son `<Link>` con las clases CHIP
`PaginationLink` del componente instalado fija `render={<a …>}` sobre `Button`,
así que no admite un `next/link` y cada número sería una recarga completa. Se usa
el andamiaje accesible (`Pagination` / `PaginationContent` / `PaginationItem` /
`PaginationEllipsis`) y los números son `<Link>` con el patrón
`CHIP/CHIP_ACTIVE/CHIP_IDLE` de `category-filters.tsx`, que es justo lo que pedía
la sección Reutilizar. `src/components/ui/pagination.tsx` no se editó salvo el
import de D1.

### D3 — La columna derecha se envolvió en un `div`
Los controles van debajo de la grilla, no al lado de `<CategoryFilters>`: como
tercer hijo del `grid lg:grid-cols-[240px_1fr]` habrían caído en la columna
izquierda de la fila 2. Grilla/estado vacío + `<CatalogPagination>` quedan dentro
de un `flex flex-col gap-4`. Nada más del layout cambió.

### D4 — `catalog-href.check.ts` extendido
El self-check que ya existía (script `check:catalog`) cubre ahora el segundo
argumento: `page` ausente / `1` → URL sin `page`; `page > 1` → `&page=N`; y
`catalogHref({ category, search })` sin segundo argumento sigue sin emitir `page`
(es lo que sostiene AC3). Corre verde.

### D5 — ACs marcados
Solo los verificables leyendo o ejecutando código: AC3 (self-check de
`catalogHref` + chips, `SortSelect` y `catalog-toolbar.tsx` intactos), AC5
(`.catch(1)` probado con `page=abc/-1/0/1.5/""` conservando `category` y
`search`), AC6 (`if (totalPages <= 1) return null`) y AC8 (`/api/products`
sin tocar; `{ limit: "5", search }` parsea a `page: 1`). AC1, AC2, AC4 y AC7
son comportamiento en navegador con la BD sembrada — y hoy hay 8 productos
sembrados contra un `PAGE_SIZE` de 12, así que para ejercer AC1/AC2/AC4 hace
falta sembrar más de 12 productos activos.

### D6 — corrección del reviewer sobre D5
El conteo de D5 ("8 productos sembrados") era incorrecto: la BD real tiene 25
productos (24 `isActive`). Verificado en review con `countPublic({})` → 24,
`listPublic` página 1/2 con 12 ítems cada una sin solapamiento y página 3 vacía
(`totalPages = 2`, no 3 como dice el AC1 literal — desfasado por 1 producto
inactivo, no es un defecto de código). AC1, AC2, AC4 y AC7 quedan verificados
contra datos reales.

## Notas
- **Orden de consultas (T7):** primero `countPublic`, después `listPublic` con la página ya recortada. Si se lanzan en paralelo, `?page=999` devuelve una lista vacía y hay que consultar de nuevo. Un roundtrip serial extra es más barato que la corrección.
- **Clamp, no redirect:** `?page=999` renderiza la última página válida con la URL tal cual llegó. Sin `redirect()`: es un caso de borde manual, no vale una navegación extra ni un bucle potencial.
- **`totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))`**: con 0 resultados sigue habiendo "página 1" (el estado vacío de spec 011) y los controles no se muestran (AC6).
- Ventana de números: con `totalPages <= 7` se listan todas; por encima, `1 … actual-1 actual actual+1 … última` con elipsis. Con 25 productos nunca se ejerce, pero es una función pura de ~8 líneas y evita un renglón de 40 links cuando el catálogo crezca.
- `limit` del schema (máx. 48) queda intacto para `/api/products`; la página fuerza `limit: PAGE_SIZE` como ya hacía con `CATALOG_LIMIT`.
