---
id: 013
title: Autocompletado del buscador del catálogo
status: done
module: products
scope: client
---

# 013 — Autocompletado del buscador del catálogo

## Objetivo
Un visitante que escribe en el buscador de `/products` ve, sin enviar el formulario,
hasta 5 coincidencias con miniatura, nombre, descripción y precio, y entra a la ficha desde ahí.

## Decisiones del usuario
- Interpretación **A**, confirmada: dropdown de sugerencias bajo el input, en vivo mientras
  escribe, máx. 5 productos; clic navega a la ficha. La grilla del catálogo **no cambia**
  hasta enviar la búsqueda. (Se descartó B: limitar la grilla a 5 con descripción en la card.)
- Cada sugerencia lleva **miniatura, nombre, descripción y precio**.

## Alcance
Incluye:
- Input del catálogo convertido en combobox accesible con listbox de sugerencias.
- Miniatura del producto en cada sugerencia, con placeholder cuando `imageUrl` es `null`.
- Debounce del texto, cancelación de peticiones en vuelo, estados de carga / error / sin coincidencias.
- Reutiliza `GET /api/products?search=&category=&limit=5` tal cual: sin endpoint ni columna nueva.

No incluye:
- Búsqueda en la landing o en el header (`src/components/shared/header.tsx` no tiene buscador).
- Resaltado del término coincidente, historial de búsquedas, sugerencias de categorías.
- Ranking por relevancia textual: sigue el `ORDER_BY.relevance` del repositorio.
- `images.remotePatterns` en `next.config.ts`: hoy está vacío y todo `imageUrl` sembrado es
  una ruta local (`/products/*.webp`). Una URL remota cargada desde el panel rompería
  `next/image` — pero ya rompe igual en el hero, el rail y la grilla, así que es un
  problema previo y se trata aparte.

## Criterios de aceptación
- [x] AC1 — Dado que escribo ≥2 caracteres cuando paso el debounce entonces veo hasta 5 sugerencias, cada una con miniatura, nombre, descripción truncada a 2 líneas y precio con `formatPrice` (PEN).
- [x] AC1b — Dado un producto con `imageUrl` en `null` entonces su sugerencia muestra el placeholder `ImageOff` en el hueco de la miniatura, con el mismo tamaño, y la fila no se desalinea.
- [x] AC2 — Dado que escribo 0 o 1 carácter entonces no se dispara ninguna petición y el dropdown queda cerrado.
- [x] AC3 — Dado que escribo rápido "not", "note", "noteb" entonces sale **una** petición (la última) y las anteriores se abortan; nunca se pinta el resultado de una vieja.
- [x] AC4 — Dado un término sin coincidencias entonces el dropdown muestra "Sin coincidencias" y no una lista vacía.
- [x] AC5 — Dado que la petición falla entonces veo un mensaje de error en el dropdown y el input sigue usable (el submit del form sigue funcionando).
- [x] AC6 — Dado el dropdown abierto cuando pulso ↓/↑ entonces se marca una opción (`aria-activedescendant`), con Enter navego a `/products/<slug>` y con Escape se cierra sin navegar.
- [x] AC7 — Dado el dropdown cerrado (o sin opción marcada) cuando pulso Enter entonces se envía el form GET y la URL pasa a `?search=…` conservando `category` y `sort` — spec 011 AC3 intacto.
- [x] AC8 — Dado `?category=notebooks` activo entonces las sugerencias respetan esa categoría.
- [x] AC9 — Dado un lector de pantalla entonces el input expone `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` y las opciones `role="option"` dentro de `role="listbox"`.

## Datos
Sin cambios de esquema. Sin migración.

## API
Sin endpoints nuevos ni cambios de schema: `limit` (1–48) ya existe en `publicProductQuerySchema`.

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/products?search=&category=&limit=5` | pública (`isPublicRoute` en `src/proxy.ts`) | — | `ProductListItem[]` |

Zod: se reutiliza `publicProductQuerySchema` (campos `search`, `category`, `limit`). Sin schema nuevo.

## Reutilizar
- `src/modules/products/services/product.service.ts` — se le agrega la función pública; no se crea otro service.
- `src/lib/axios.ts` — `api` (baseURL `/api`); acepta `{ params, signal }` de axios.
- `src/modules/products/schemas/product.schema.ts` — `PublicProductQuery` para tipar los filtros.
- `src/modules/products/types/product.ts` — `ProductListItem` (trae `description`, `price`, `slug`). Sin tipos nuevos.
- `src/modules/products/lib/catalog-href.ts` — `CatalogQuery` (el tipo de `query` que ya recibe la toolbar).
- `src/lib/money.ts` — `formatPrice(cents)`.
- `src/components/ui/input.tsx` — el mismo `<Input type="search">` que hoy usa la toolbar.
- Patrón de imagen con fallback ya resuelto en `src/modules/products/components/hero-product.tsx`
  y `product-rail.tsx`: `next/image` cuando hay `imageUrl`, `<ImageOff />` de lucide cuando no.
  Se replica, no se inventa otro.
- `src/components/providers/query-provider.tsx` — `QueryClientProvider` ya está en `src/app/layout.tsx`; no se monta otro.
- `src/modules/products/components/catalog-toolbar.tsx` — sigue siendo Server Component: solo se le sustituye el bloque del `<Input>`.
- Tokens `bg-card`, `bg-panel`, `--shadow-lift`, `rounded-3xl` de `globals.css` para el panel flotante.
- **No hace falta instalar componentes shadcn** (ver Notas sobre `command`).

## Tareas
- [x] T1 — `searchPublicProducts({ search, category, limit, signal })` → `api.get("/products", { params, signal })` · `src/modules/products/services/product.service.ts`
- [x] T2 — `useDebouncedValue(value, delay)` transversal (`setTimeout` + cleanup) · `src/hooks/use-debounced-value.ts`
- [x] T3 — `useProductSuggestions(term, category)`: `useQuery` con `queryKey ["products","suggestions",term,category]`, `enabled: term.length >= 2`, `queryFn: ({ signal }) => …`, `staleTime` y `placeholderData: keepPreviousData` · `src/modules/products/hooks/use-product-suggestions.ts`
- [x] T4 — `<SearchAutocomplete defaultValue category>` (`"use client"`, único del árbol): input controlado + listbox, teclado ↓/↑/Enter/Escape, `aria-activedescendant`, cierre en blur, estados carga/error/vacío con `aria-live="polite"`. Cada opción: miniatura 40×40 (`next/image` con `sizes="40px"`, o `ImageOff` si `imageUrl` es `null`), nombre, descripción `line-clamp-2` y precio · `src/modules/products/components/search-autocomplete.tsx`
- [x] T5 — Sustituir el bloque del `<Input>` por `<SearchAutocomplete>` dentro del `<form action="/products">`, sin tocar los hidden ni el botón submit · `src/modules/products/components/catalog-toolbar.tsx`

Verificación final: `npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Desvíos de implementación
- El envoltorio `<div className="relative flex-1">` y el ícono `<Search>` se
  mudaron de `catalog-toolbar.tsx` al propio `<SearchAutocomplete>`: el panel
  absoluto necesita ese `relative` como ancla y dejarlo en el server component
  obligaba a partir el componente en dos por nada. Los hidden, el `<form
  action="/products">` y el botón submit quedaron intactos.
- `onMouseEnter` también marca la opción (`activeIndex`), no solo el teclado: si
  no, el resaltado visual y `aria-activedescendant` se contradicen al mezclar
  mouse y flechas.
- AC marcados: solo AC2 y AC9, que se verifican leyendo el código (`enabled:
  term.length >= 2` y los atributos ARIA del markup). El resto es
  comportamiento en navegador con la BD sembrada; queda para el reviewer.

## Notas
- La cancelación real la da el `signal` que TanStack Query pasa al `queryFn` reenviado a axios; el debounce (≈250 ms) solo reduce el volumen. Hacen falta los dos (AC3).
- El input queda **dentro** del `<form action="/products">` existente: con opción marcada, `onKeyDown` hace `preventDefault()` + `router.push`; sin opción marcada, el submit nativo sigue su curso. Es lo que preserva 011 AC3.
- No se instala `command` de shadcn: `cmdk` trae su propio input controlado y secuestra Enter, que es justo lo que debe seguir enviando el form. Combobox a medida sobre el `<Input>` ya instalado, sin dependencia nueva.
- Descripción truncada con `line-clamp-2` (CSS), no con un helper de recorte. `description` es nullable: si es `null`, la línea no se renderiza.
- La miniatura va con `alt=""` (decorativa): el nombre del producto ya está en el texto de la
  opción y un `alt` con el mismo nombre se lo lee dos veces al lector de pantalla.
- Miniatura de lado fijo (`size-10` + `object-cover`) para que las 5 filas midan igual y la
  lista no salte mientras llegan los datos.
- Las opciones son `<div role="option">` con `onMouseDown` (no `onClick`): el blur del input dispara antes que el click y se comería la navegación.
- `GET /api/products` responde con `Cache-Control: public, s-maxage=60`, así que términos repetidos ni llegan al origen.
