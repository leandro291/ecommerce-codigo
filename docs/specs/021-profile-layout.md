---
id: 021
title: Tabs en Mi cuenta (perfil, favoritos, compras)
status: done
module: shared
scope: client
---

# 021 — Tabs en Mi cuenta (perfil, favoritos, compras)

## Objetivo
Un cliente logueado alterna entre "Mi perfil", "Mis favoritos" y "Mis compras"
con tabs dentro de `/profile`, en vez de verlas apiladas.

## Decisión
Tabs client-side, sin rutas nuevas: `src/components/ui/tabs.tsx` **ya está
instalado** (base-ui, sin usos todavía), así que la feature son dos archivos y
cero cambios de navegación. Favoritos hoy es un cartel vacío; cuando sea una
feature real se evalúan rutas propias.

## Alcance
Incluye: un client component con los tabs y el reacomodo de `profile/page.tsx`.
No incluye: rutas `/profile/*`, implementar favoritos, tocar la API de órdenes,
persistir la tab activa en la URL.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario logueado, cuando entra a `/profile`, entonces ve las
      tres tabs y la de "Mi perfil" activa con sus datos de Clerk.
- [ ] AC2 — Dado que está en `/profile`, cuando abre "Mis compras", entonces ve
      el filtro de período y el historial con su carga/error habituales.
- [ ] AC3 — Dado que abre "Mis favoritos", entonces ve "Todavía no guardaste
      ningún producto" y el botón "Ver catálogo".
- [ ] AC4 — Dado que nunca abre "Mis compras", entonces no se dispara la request
      a `/api/orders` (los panels de base-ui no montan sin `keepMounted`).
- [ ] AC5 — `profile/page.tsx` sigue sin `"use client"`: llama `currentUser()` en
      el servidor y pasa las secciones ya renderizadas al componente de tabs.
- [ ] AC6 — Las tabs se recorren con teclado (flechas + Tab) y la activa expone
      su estado seleccionado; lo da base-ui, no se implementa a mano.

## Datos
Sin cambios de esquema.

## API
Sin endpoints nuevos ni cambios de contrato.

## Reutilizar
- `src/components/ui/tabs.tsx` — YA instalado. **No** correr
  `npx shadcn@latest add tabs`. Exporta `Tabs` (Root, prop `defaultValue`),
  `TabsList`, `TabsTrigger` (base-ui `Tab`, prop `value`) y `TabsContent`
  (base-ui `Panel`, prop `value`).
- `src/modules/orders/components/purchases-section.tsx` — se usa TAL CUAL: su
  filtro es `useState` interno, no depende de dónde esté montado.
- `src/components/shared/reveal.tsx` — la animación de entrada pasa a envolver
  el bloque de tabs, una sola vez.
- `src/app/(storefront)/profile/page.tsx` — los helpers `Field` y `EmptySection`
  y el markup de las tres secciones se quedan donde están; solo cambia el
  contenedor.

## Tareas
- [x] T1 — Crear el client component de tabs: `"use client"`, tres props
      `ReactNode` (`profile`, `favorites`, `purchases`), `Tabs` con
      `defaultValue="profile"`, `TabsList` con los tres `TabsTrigger` y un
      `TabsContent` por sección. Sin lógica de datos adentro ·
      `src/components/shared/profile-tabs.tsx`
- [x] T2 — En la página, reemplazar el `Reveal` con las tres secciones apiladas
      por `<ProfileTabs profile={...} favorites={...} purchases={<PurchasesSection />} />`,
      manteniendo `currentUser()`, el `<main>` y el `h1 "Mi cuenta"` ·
      `src/app/(storefront)/profile/page.tsx`

Verificación final: `npm run typecheck && npm run lint`

## Notas
- Va en `components/shared/` y no en un `modules/profile/` nuevo: es un solo
  archivo de presentación sin dominio propio.
- Las secciones se pasan como props `ReactNode` (no como imports dentro del
  client component) para que la Card de perfil siga renderizándose en el
  servidor con los datos de Clerk.
- No poner `keepMounted` en los panels: el default evita montar
  `PurchasesSection` —y su query— hasta que el usuario abre esa tab.
- Tab activa en estado local, sin querystring. Si más adelante hace falta
  linkear directo a compras, ahí se sube a la URL.
