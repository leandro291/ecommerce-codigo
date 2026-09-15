---
id: 010
title: Landing storefront + endpoints públicos de catálogo
status: done
module: products
scope: client
---

# 010 — Landing storefront + endpoints públicos de catálogo

## Objetivo
Un visitante anónimo entra a `/` y ve el bento del diseño (`design/Main.dc.html`)
con productos y categorías reales de la BD, servidos con datos cacheados.

## Alcance
Incluye:
- Landing en `/` (desktop `design/Main.dc.html`, mobile `design/Mobile.dc.html`): hero, rail de destacados, tiles de categorías.
- `GET /api/products` y `GET /api/categories` públicos, solo lectura, solo registros activos.
- Tokens visuales del diseño (paleta, radios, fuente display) y assets `design/assets/*.webp` en `public/`.
- Animaciones de entrada/hover con `motion`; carrusel del rail con `swiper`.

No incluye:
- Página de catálogo `/products` y ficha `/products/[slug]` → spec siguiente (`design/Catalog*.dc.html`).
- Carrito y drawer, buscador con resultados, toggle de tema, swatches de color, valoraciones (no hay modelo).
- Service/hook cliente de catálogo: nadie los consume todavía (la landing es Server Component). Llegan con el spec de catálogo.

## Criterios de aceptación
- [ ] AC1 — Dado un producto `isFeatured && isActive` cuando cargo `/` entonces el hero muestra su nombre, imagen y precio con `formatPrice`.
- [ ] AC2 — Dado el catálogo sembrado cuando cargo `/` entonces el rail lista hasta 6 productos activos y ninguno inactivo.
- [ ] AC3 — Dado categorías activas cuando cargo `/` entonces los tiles salen ordenados por `position` y enlazan a `/products?category=<slug>`.
- [ ] AC4 — Dado sin sesión cuando `GET /api/products?featured=true&limit=6` entonces 200 con array de productos activos (nunca inactivos).
- [ ] AC5 — Dado sin sesión cuando `GET /api/categories` entonces 200 con solo categorías activas por `position`.
- [ ] AC6 — Dado `GET /api/products?limit=999` entonces 400 con `{ error, issues }`.
- [ ] AC7 — Dado viewport 390px cuando cargo `/` entonces no hay scroll horizontal; con `prefers-reduced-motion` no corren las animaciones.

## Datos
Sin cambios de esquema. `products.imageUrl` y `categories.imageUrl` ya existen y hoy están vacíos:
el seed pasa a poblarlos con rutas locales (`/products/*.webp`). Sin migración.

## API
| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/products?featured&category&search&limit` | pública | — | `ProductListItem[]` (solo `isActive`) |
| GET | `/api/categories` | pública | — | `Category[]` (solo `isActive`, por `position`) |

Zod — `publicProductQuerySchema` en `src/modules/products/schemas/product.schema.ts`:
`featured` (boolean coercionado, opcional) · `category` (slug, opcional) · `search` (string trim ≤80, opcional) ·
`limit` (int coercionado, 1–48, default 12). `/api/categories` no recibe parámetros: no lleva schema.

Caché: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` en ambos GET;
`export const revalidate = 300` en la landing. **No** se activa `cacheComponents` en `next.config.ts`:
es un flag global que obliga a envolver en Suspense todo el panel admin, que sí lee `auth()`.

## Reutilizar
- `src/server/repositories/category.repository.ts` — `list({ isActive: true })` ya filtra y ordena por `position`; el handler no toca nada más.
- `src/server/repositories/product.repository.ts` — se le suma `listPublic()`; `list()` ya resuelve el JOIN de categoría sin N+1, se copia ese patrón.
- `src/lib/money.ts` — `formatPrice(cents)` para todo precio en pantalla.
- `src/modules/products/types/product.ts` — `ProductListItem` (incluye `categoryName`). No se declara un tipo público nuevo.
- `src/modules/categories/types/category.ts` — `Category`.
- `src/proxy.ts` — `/`, `/api/products(.*)` y `/api/categories(.*)` ya están en `isPublicRoute`. Sin cambios.
- `src/components/shared/header.tsx` — se reestiliza; los botones Clerk (`Show`, `UserButton`) quedan como están.
- `src/components/ui/` — `button`, `card`, `badge`, `skeleton` ya instalados. No hace falta agregar componentes shadcn.
- `design/assets/*.webp` — imágenes del diseño; se copian a `public/products/`, así `next/image` no necesita `remotePatterns`.

Dependencias nuevas (autorizadas por el usuario, con su razón):
- `motion` — reveal on-scroll y micro-interacciones del bento; CSS solo no cubre entrada por viewport sin `IntersectionObserver` a mano.
- `swiper` — rail de destacados con autoplay, loop y breakpoints. Si al implementarlo el rail no necesita autoplay ni loop, se resuelve con `overflow-x-auto` + `snap-x` y **no** se importa Swiper.

## Tareas
- [x] T1 — Instalar dependencias · `npm i motion` (sin `swiper`: el rail no lleva autoplay ni loop → scroll-snap nativo)
- [x] T2 — Copiar assets del diseño a `public/products/` y poblar `imageUrl` de productos y categorías · `src/server/db/seed.ts`
- [x] T3 — Agregar `listPublic(filters)` (solo activos, JOIN categoría, filtros featured/category/search/limit) · `src/server/repositories/product.repository.ts`
- [x] T4 — Agregar `publicProductQuerySchema` · `src/modules/products/schemas/product.schema.ts`
- [x] T5 — Handler `GET` público con validación Zod de query y `Cache-Control` · `src/app/api/products/route.ts`
- [x] T6 — Handler `GET` público de categorías activas · `src/app/api/categories/route.ts`
- [x] T7 — Tokens del diseño (paleta accent, gradiente de página, radios, sombras) sobre las variables existentes · `src/app/globals.css`
- [x] T8 — Fuente display `Space_Grotesk` vía `next/font` en `--font-heading` · `src/app/layout.tsx`
- [x] T9 — Componente cliente `Reveal` con `motion` que respeta `prefers-reduced-motion` · `src/components/shared/reveal.tsx`
- [x] T10 — `ProductCard` (server, imagen + precio + fallback sin imagen) · `src/modules/products/components/product-card.tsx`
- [x] T11 — `HeroProduct` con el destacado del diseño · `src/modules/products/components/hero-product.tsx`
- [x] T12 — `ProductRail` (server: sin Swiper no hay interactividad, scroll-snap nativo) · `src/modules/products/components/product-rail.tsx`
- [x] T13 — `CategoryTiles` con enlaces a `/products?category=<slug>` · `src/modules/categories/components/category-tiles.tsx`
- [x] T14 — Landing: lee repositorios, compone el bento, `revalidate`, `metadata` y estado vacío · `src/app/(storefront)/page.tsx`
- [x] T15 — Reestilizar el header como card flotante del diseño · `src/components/shared/header.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Notas
- `docs/SETUP.md` §4 autoriza `Server Component → repositorio` para la lectura inicial con SEO: la landing lee repos desde `page.tsx` y **no** pasa por `/api`. La regla "un componente nunca importa un repositorio" sigue vigente para todo lo que viva en `modules/`.
- Los tiles enlazan a `/products`, que todavía no existe: hasta el spec de catálogo esos enlaces dan 404. Es deliberado, no se cambia el destino después.
- Si `ClerkProvider` fuerza render dinámico, `revalidate` de la landing no aplica; el `s-maxage` de los endpoints sigue en pie y no bloquea la entrega.
- El seed corre `db:seed`, que es destructivo sobre datos de prueba: no se ejecuta contra datos reales sin avisar.

## Desvíos de implementación
- **`swiper` no se instaló.** El rail no necesita autoplay ni loop; se resolvió con
  `overflow-*-auto` + `snap`. Por eso `ProductRail` quedó Server Component (no hay
  interactividad que justifique `"use client"`), en vez de cliente como decía T12.
- **Tokens con nombre propio.** `--brand` / `--brand-foreground` en vez de pisar
  `--accent`: `--accent` es el hover de todo shadcn y cambiarlo rompería el panel admin.
  Se agregaron además `--page-gradient`, `--panel`, `--card-soft`, `--shadow-soft`,
  `--shadow-lift` y `--radius-5xl` (30px, el radio del panel del diseño).
- **`src/app/(storefront)/layout.tsx` tocado** (no estaba en las tareas): el gradiente
  de página tiene que cubrir header y contenido, y el header vive en el layout.
- **`seed.ts` pasó de `onConflictDoNothing` a `onConflictDoUpdate` sobre `image_url`**
  en productos y categorías. Con `DoNothing`, las filas ya sembradas nunca habrían
  recibido la imagen. Solo se pisa esa columna; el resto es dato vivo del admin.
- **Fuera del diseño literal:** el hero se arma con el producto destacado real de la BD
  (nombre, descripción, imagen, precio), no con el copy fijo "Sonido que te envuelve" ni
  con `hero-headphones.webp`. Los swatches de color, buscador, carrito, toggle de tema y
  valoraciones quedaron afuera por alcance. `ssd-kingston-nv2-1tb` se dejó sin `imageUrl`
  a propósito: ejercita el fallback de `ProductCard`.
- Las cards de producto enlazan a `/products/<slug>`, que todavía no existe (mismo 404
  deliberado que los tiles, hasta el spec de catálogo).
- **`error.tsx` y `loading.tsx` en `(storefront)`** (review 1, no estaban en las tareas):
  la landing lee BD y CLAUDE.md §6 exige estados de carga y error. El boundary usa
  `retry` — en Next 16 `reset` quedó relegado a "re-render sin re-fetch", y acá lo que
  falla es la lectura, así que hay que re-ejecutarla.
- **Seed curado y ejecutado** (post-cierre): los `productRow` no traían `description`
  y tanto el hero como `listPublic(search)` la usan; se completaron las ocho, más
  `description` en las cinco categorías (los tiles la renderizan). El hero pasó a
  tener un **único** `isFeatured: true` (`notebook-lenovo-ideapad-3`): con dos
  destacados el orden `desc(isFeatured), asc(name)` lo resolvía por alfabético y
  ganaba el monitor. El `set` del `onConflictDoUpdate` se amplió a `description`,
  `compare_at_price` e `is_featured` en productos y a `description` en categorías;
  con solo `image_url` las filas ya sembradas nunca habrían recibido el texto, y sin
  pisar `is_featured` un destacado viejo vuelve a competir por el hero. Nombre,
  precio, stock, SKU y `is_active` siguen siendo dato vivo del admin.
- **Ningún componente renderiza campos fuera del schema.** El diseño trae `rating`
  y swatches de color; ambos ya estaban fuera de alcance y ningún componente los
  referencia, así que no hay hueco que tapar. No se tocó el schema Drizzle.
- **Rail de 6 cards → una sola imagen destacada** (ajuste posterior al cierre, pedido
  del usuario): `ProductRail` recibe un `ProductListItem` y renderiza la card-imagen
  full-bleed del diseño (líneas 375-383 de `Main.dc.html`). Es el producto más caro que
  no sea el del hero. AC2 queda superado por este cambio; `/api/products?limit=6` sigue
  devolviendo la lista. `ProductCard` queda sin consumidor hasta el spec de catálogo.
- **Landing desktop acotada a `100dvh`**: de `lg:` hacia arriba el panel bento no genera
  scroll de página (`lg:h-dvh` en el layout, grid de dos filas `1.7fr/1fr`, paddings y
  márgenes del hero comprimidos, tiles en una sola fila con scroll horizontal si sobran
  categorías). En mobile/tablet el scroll natural queda como estaba.
- **Assets recortados** (review 1): de `design/assets/` solo quedan en `public/products/`
  los cinco `.webp` que el seed referencia. `earbuds`, `feature-headphones`,
  `hero-headphones`, `speaker` y `thumb-watch` se borraron por no tener consumidor.
