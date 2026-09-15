---
id: 011
title: Catálogo público y ficha de producto
status: done
module: products
scope: client
---

# 011 — Catálogo público y ficha de producto

## Objetivo
Un visitante anónimo entra a `/products`, filtra por categoría, busca y ordena, y
abre `/products/<slug>` para ver la ficha del producto. Se acaban los 404 que dejó el spec 010.

## Alcance
Incluye:
- `/products` (desktop `design/Catalog.dc.html`, mobile `design/CatalogMobile.dc.html`): chips de categoría, buscador, selector de orden, grilla, estado vacío.
- Filtros por URL (`?category=&search=&sort=`): la página es Server Component y lee el repositorio.
- `/products/[slug]`: imagen, categoría, nombre, descripción, precio, precio tachado y stock. 404 si el slug no existe o el producto está inactivo.
- `sort` en `publicProductQuerySchema` + `listPublic` (lo hereda `GET /api/products` por compartir schema).

No incluye:
- Carrito, drawer, botón "Agregar", favoritos y toggle de tema del diseño → feature aparte, en evaluación paralela.
- Rating / "Mejor valorados" del select: no hay modelo de valoraciones.
- Paginación e infinite scroll: `limit` fijo de 48 (el máximo del schema). Con 8 productos sembrados no hay nada que paginar.
- Endpoint `GET /api/products/[slug]`: la ficha no tiene otro consumidor.
- Galería de imágenes: `products` tiene una sola `imageUrl`.

## Criterios de aceptación
- [ ] AC1 — Dado el catálogo sembrado cuando cargo `/products` entonces veo la grilla de productos activos (2 columnas en 390px, 4 en desktop) y ningún inactivo.
- [ ] AC2 — Dado `/products?category=notebooks` entonces solo salen productos de esa categoría y su chip queda marcado como activo.
- [ ] AC3 — Dado que escribo en el buscador y envío entonces la URL pasa a `?search=<texto>` conservando `category` y `sort`, y la grilla se filtra.
- [ ] AC4 — Dado `?sort=price-asc` entonces la grilla sale de menor a mayor precio; `price-desc`, al revés.
- [ ] AC5 — Dado un filtro sin resultados entonces veo el estado vacío con enlace "Limpiar filtros" a `/products`.
- [ ] AC6 — Dado `?category=Nope!!` o `?sort=cualquiera` entonces la página no rompe: cae a los defaults y muestra el catálogo completo.
- [x] AC7 — Dado `/products/<slug>` de un producto activo entonces veo su ficha con precio vía `formatPrice` y `<title>` con el nombre.
- [x] AC8 — Dado `/products/<slug>` inexistente o de un producto inactivo entonces 404 (`notFound()`).

## Datos
Sin cambios de esquema. Sin migración.

## API
Sin endpoints nuevos. `GET /api/products` gana el parámetro opcional `sort` por
compartir `publicProductQuerySchema`.

Zod — `publicProductQuerySchema` (`src/modules/products/schemas/product.schema.ts`):
se agrega `sort: z.enum(["relevance", "price-asc", "price-desc"]).default("relevance")`.
`relevance` = el orden actual `desc(isFeatured), asc(name)`.

## Reutilizar
- `src/modules/products/components/product-card.tsx` — la card del grid; hoy sin consumidor. Solo se le suma el badge `-N%`.
- `src/server/repositories/product.repository.ts` — `listPublic()` ya resuelve activos + `category` + `search` + JOIN sin N+1; se le suman `sort` y `findPublicBySlug`.
- `src/server/repositories/category.repository.ts` — `list({ isActive: true })` para los chips.
- `src/lib/money.ts` — `formatPrice(cents)`.
- `src/modules/products/types/product.ts` — `ProductListItem` (trae `categoryName`). Sin tipos nuevos.
- `src/components/shared/reveal.tsx` — animación de entrada del grid, ya respeta `prefers-reduced-motion`.
- `src/app/(storefront)/{layout,loading,error}.tsx` — header, gradiente y boundaries se heredan en las rutas hijas. No se crean nuevos.
  (Corrección en review: `loading.tsx` se acotó a la landing, ver Desvíos.)
- `src/components/ui/{input,select,badge,button}.tsx` — ya instalados. **No hace falta instalar componentes shadcn.**
- `src/proxy.ts` — `/products(.*)` ya está en `isPublicRoute` (línea 6). Sin cambios.
- Tokens `--brand`, `--panel`, `--card-soft`, `--shadow-soft/lift`, `rounded-5xl` de `globals.css`: los chips y el panel del diseño de catálogo usan la misma paleta que la landing.

## Tareas
- [x] T1 — Agregar `sort` al schema público · `src/modules/products/schemas/product.schema.ts`
- [x] T2 — Aplicar `sort` en el `orderBy` de `listPublic` · `src/server/repositories/product.repository.ts`
- [x] T3 — Agregar `findPublicBySlug(slug)` (solo `isActive`, JOIN categoría) · `src/server/repositories/product.repository.ts`
- [x] T4 — Badge de descuento `-N%` cuando hay `compareAtPrice` · `src/modules/products/components/product-card.tsx`
- [x] T5 — `SortSelect` (client, único `"use client"`: `onChange` → `router.replace` con los params actuales) · `src/modules/products/components/sort-select.tsx`
- [x] T6 — `CatalogToolbar` (server: chips `<Link>` con `category` + form GET de búsqueda con `category`/`sort` en hidden + `<SortSelect>`) · `src/modules/products/components/catalog-toolbar.tsx`
- [x] T7 — Página `/products`: `await searchParams`, parseo con `safeParse` (fallback a defaults), grilla, contador de resultados, estado vacío, `metadata` · `src/app/(storefront)/products/page.tsx`
- [x] T8 — Ficha `/products/[slug]`: `await params`, `findPublicBySlug`, `notFound()`, `generateMetadata`, `revalidate` · `src/app/(storefront)/products/[slug]/page.tsx`
- [x] T9 (review 1) — Acotar `loading.tsx` a la landing para que `notFound()` devuelva 404 real · `src/app/(storefront)/(landing)/{page,loading}.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Desvíos de implementación

### D1 — `loading.tsx` movido a `(storefront)/(landing)/` (fix de AC8)
El reviewer reportó que `/products/<slug-inexistente>` devolvía `200 OK` en
producción y lo atribuyó al `x-middleware-rewrite` de `clerkMiddleware`. **No era
eso.** La causa real es `src/app/(storefront)/loading.tsx`: un `loading.tsx` crea
un Suspense boundary para el segmento *y todos sus hijos*, así que el shell se
flusheaba con status 200 antes de que la ficha llegara a llamar `notFound()`.

Aislado con cuatro rutas de prueba temporales (ya borradas), mismo build y mismo
`next start`:

| ruta | dentro de `(storefront)` | middleware | status |
|---|---|---|---|
| `/nfout` (`notFound()`) | no | excluida del matcher | 404 |
| `/nfin` (`notFound()`) | no | sí | 404 |
| `/nfdyn/[x]` (`notFound()`) | no | sí | 404 |
| `/nfsf` (`notFound()`) | sí | sí | **200** |

Con `loading.tsx` renombrado, `/nfsf` y `/products/<slug>` pasaron a 404. Ni el
middleware ni el segmento dinámico ni `revalidate` intervienen.

Fix: la landing se movió a un route group `(landing)` — no cambia la URL, `/`
sigue siendo `/` — y `loading.tsx` con ella. El skeleton ya estaba diseñado con
las proporciones exactas del bento de la landing (mal encaje en catálogo y
ficha), así que acotarlo también corrige eso. Catálogo y ficha quedan sin
boundary ancestro.

**`src/proxy.ts` no se tocó** (`git diff` contra el árbol previo: vacío). El
rewrite de Clerk existe pero es inocuo para el status.

### D2 — `<FavoriteButton>` en la ficha
No está en T1–T8. Es reutilización directa del componente ya shippeado en el
BUILD de favoritos (`src/modules/products/components/favorite-button.tsx`, mismo
store Zustand, sin lógica nueva). La card del grid ya lo muestra: sería
inconsistente que el grid tenga favoritos y la ficha del mismo producto no. El
corazón de `product-card.tsx` es herencia de ese BUILD, no de este spec; T4 solo
agregó el badge `-N%`.

## Notas
- `searchParams` y `params` son `Promise` en Next 16 (confirmado en `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`): se `await`ean. Usar `searchParams` vuelve `/products` dinámica, así que `revalidate` ahí no aporta; en `[slug]` sí (`export const revalidate = 300`, sin `generateStaticParams`).
- Los params llegan del usuario: `publicProductQuerySchema.safeParse` con fallback a defaults, **no** `parse` (tirar 500 por un query param torcido es peor que ignorarlo). El handler de `/api/products` sigue devolviendo 400: ahí el contrato es explícito.
- El contador de resultados sale de `products.length`, no de un `COUNT(*)`. Con `limit` 48 alcanza; si el catálogo lo supera, ahí sí entra paginación y un count real.
- Diseño no implementado a propósito: botón "Agregar", ícono de carrito con badge, ★ rating y toggle de tema. La card queda sin CTA — el botón llega con el spec de carrito, no se deja un botón muerto.
- El diseño trae 12 productos de muestra en 4 columnas; con 8 sembrados la grilla se ve corta. Es dato real, no bug.
