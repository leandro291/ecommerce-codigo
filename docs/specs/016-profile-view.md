---
id: 016
title: Vista de perfil del cliente
status: done
module: shared
scope: client
---

# 016 — Vista de perfil del cliente

## Objetivo
Un cliente autenticado entra desde el dropdown de su avatar a `/profile` y ve sus
datos de Clerk, más las secciones de favoritos y compras en estado vacío.

## Alcance
Incluye:
- Ruta `/profile` (Server Component) con 3 secciones: Mi perfil · Mis favoritos · Mis compras.
- "Mi perfil": avatar, nombre, email, usuario y fecha de alta, leídos de Clerk.
- "Mis favoritos" y "Mis compras": estado vacío estático con CTA al catálogo.
- Item "Mi perfil" en el menú del `<UserButton />`.

No incluye:
- Tablas, migraciones, Route Handlers, repositorios, services ni hooks.
- Listar los favoritos reales ni las órdenes (no hay endpoint; ver Notas).
- Edición de datos: eso ya lo cubre el `<UserProfile />` propio de Clerk.
- Cambios en `src/proxy.ts`: `/profile` no está en `isPublicRoute`, así que ya
  cae en `auth.protect()`. Verificado.

## Criterios de aceptación
- [x] AC1 — Dado un usuario anónimo, cuando entra a `/profile`, entonces Clerk lo
      redirige a sign-in (comportamiento actual del proxy, sin código nuevo).
- [x] AC2 — Dado un usuario con sesión, cuando abre el dropdown del avatar,
      entonces ve el item "Mi perfil" antes de las opciones nativas de Clerk y al
      clickearlo navega a `/profile`.
- [x] AC3 — Dado un usuario con sesión, cuando entra a `/profile`, entonces la
      sección "Mi perfil" muestra su foto, nombre completo, email primario,
      usuario (o "—" si es `null`) y fecha de alta formateada en es-AR.
- [x] AC4 — Dado ese mismo usuario, entonces "Mis favoritos" y "Mis compras"
      muestran cada una un mensaje de vacío y un botón "Ver catálogo" a `/products`.
- [x] AC5 — La página no envía `"use client"`: solo `<Avatar>` y `<UserButton>`
      son islas cliente.

## Datos
Sin cambios de esquema. Sin lectura de Postgres: los datos salen de Clerk.

## API
Sin endpoints nuevos. Sin Zod (no hay entrada de usuario que validar).

Lectura en servidor: `currentUser()` de `@clerk/nextjs/server` (verificado en
`node_modules/@clerk/nextjs/dist/types/server/index.d.ts`). Campos disponibles en
el resource `User` (verificado en `@clerk/backend/dist/api/resources/User.d.ts`):
`imageUrl`, `fullName`, `primaryEmailAddress?.emailAddress`, `username`,
`createdAt` (epoch ms → `new Date(...)`).
Tipo `User | null`: si viene `null`, `redirect("/sign-in")`.

## Reutilizar
- `src/components/ui/card.tsx` — `Card`/`CardHeader`/`CardTitle`/`CardContent` para cada sección.
- `src/components/ui/avatar.tsx` — `Avatar`/`AvatarImage`/`AvatarFallback` (instalado, hoy sin uso). Evita configurar `images.remotePatterns` para `img.clerk.com`, que `next/image` sí exigiría.
- `src/components/ui/button.tsx` — `Button asChild` + `<Link>` para el CTA "Ver catálogo".
- `src/components/ui/separator.tsx` — opcional entre secciones.
- `src/components/shared/reveal.tsx` — animación de entrada, mismo patrón que `(storefront)/products/page.tsx`.
- `src/components/shared/header.tsx` — ahí vive el `<UserButton />` dentro de `<Show when="signed-in">`.
- `@clerk/nextjs` ya exporta `UserButton.MenuItems` y `UserButton.Link` (`{ href, label, labelIcon }`), verificado en `@clerk/react/dist/index.d.mts`. Todo el módulo es `"use client"`, así que se puede componer desde el Header (Server Component) sin marcarlo cliente.
- Íconos: `lucide-react` (`User`, `Heart`, `Package`), ya en uso en el repo.

Sin componentes shadcn nuevos que instalar.

## Tareas
- [x] T1 — Página `/profile`: `currentUser()`, `metadata`, las 3 secciones y un
      helper local `EmptySection` usado dos veces · `src/app/(storefront)/profile/page.tsx`
- [x] T2 — Agregar `<UserButton.MenuItems><UserButton.Link href="/profile"
      label="Mi perfil" labelIcon={<User className="size-4" />} /></UserButton.MenuItems>`
      dentro del `<UserButton>` existente · `src/components/shared/header.tsx`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- `currentUser()` pega a la Backend API de Clerk en cada render de la página. Es
  aceptable para una vista de perfil; si molesta la latencia, la alternativa es
  `useUser()` en cliente. No optimizar todavía.
- Favoritos ya tiene store real: `src/modules/products/store/favorites.store.ts`
  guarda `ids` en localStorage (lo escribe `favorite-button.tsx`). Se deja el
  estado vacío estático a pedido del usuario; para llenarlo alcanzaría con un
  filtro `ids` en `/api/products` + un componente cliente. Fuera de alcance.
- `src/modules/orders/` está vacío (solo `.gitkeep`): no hay vista de compras que
  duplicar.
- La sección "Mis compras" no crea `src/app/(storefront)/orders/page.tsx`; esa
  ruta queda para el spec de órdenes.
