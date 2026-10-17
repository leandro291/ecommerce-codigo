---
id: 006
title: Enforcement RBAC (borde + servidor)
status: done
module: auth
scope: admin
---

# 006 — Enforcement RBAC (borde + servidor)

## Contexto
Los specs 004 (tablas RBAC, `requirePermission`, `requirePanelAccess`) y 005
(webhook Clerk → `publicMetadata { roles, panel }`) están construidos pero **sin
consumidores**: `src/proxy.ts` solo exige sesión y los 10 handlers de
`/api/admin/**` solo chequean `userId`. Fase 3 de la hoja de ruta RBAC.

## Objetivo
Un usuario sin `dashboard.read` no entra a `/admin`, y cada handler de
`/api/admin/**` responde `403` sin el permiso de su acción.

## Alcance
Incluye: claim optimista en `proxy.ts`; guard `requirePanelAccess` en el layout
admin; página `/sin-acceso`; `<AdminNav>` filtrado por permisos en el server;
`requirePermission` en los 10 handlers admin.
No incluye: auditar mutaciones `product.*`/`category.*` (deuda 004 §11);
`/admin/users`, `/admin/roles`, `/admin/audit-logs` (fases 4–6); cambios en el
seed, en `ROLE_PERMISSIONS` o en `rbac.check.ts`; Fase 0 (migrate/seed/sync,
alta del webhook, commit) — prerrequisito humano.

## Paso manual previo (Clerk dashboard, no es código)
Sessions → *Customize session token* → agregar `{"metadata": "{{user.public_metadata}}"}`.
Sin esto `sessionClaims.metadata` llega `undefined` y el borde cae al modo
optimista: deja pasar y decide el servidor. El sistema es correcto igual.

## Criterios de aceptación
- [ ] AC1 — Dado un usuario con puesto `customer` (sin `dashboard.read`), cuando abre `/admin/products`, entonces termina en `/sin-acceso` con un mensaje claro y enlace a `/`.
- [ ] AC2 — Dado ese mismo usuario y el claim `metadata.panel === false` presente, cuando pide `/admin`, entonces el redirect a `/sin-acceso` ocurre en `proxy.ts` sin llegar a la BD. (El corte del borde alcanza **solo a las páginas** `/admin(.*)`; `/api/admin(.*)` responde siempre JSON desde el handler — ver AC6/AC7 y decisión 3.)
- [ ] AC3 — Dado un usuario con `metadata` ausente en el token (paso manual no hecho), cuando pide `/admin`, entonces el borde lo deja pasar y `requirePanelAccess()` en el layout decide (redirect si falta `dashboard.read`, render si lo tiene).
- [ ] AC4 — Dado un usuario con puesto `manager`, cuando abre `/admin`, entonces el nav muestra Categorías y Productos (tiene ambos `.read`) y el activo queda marcado según la ruta.
- [ ] AC5 — Dado un usuario cuyo puesto no tiene `categories.read` pero sí `dashboard.read`, cuando abre `/admin`, entonces el nav no muestra el item Categorías.
- [ ] AC6 — Dado un usuario sin sesión, cuando llama cualquier endpoint de `/api/admin/**`, entonces recibe `401 {"error":"No autenticado"}`.
- [ ] AC7 — Dado un usuario autenticado sin el permiso del método, cuando llama ese endpoint (p. ej. `employee` → `DELETE /api/admin/products/1`), entonces recibe `403 {"error":"No tenés permiso para esta acción"}` y el repositorio no se ejecuta.
- [ ] AC8 — Dado un usuario con el permiso del método, cuando llama el endpoint con datos válidos, entonces la respuesta es idéntica a la actual (200/201/204 y mismos cuerpos de error 400/404/409/500).
- [x] AC9 — Dado `/sin-acceso`, cuando la abre un usuario con permisos de panel, entonces se renderiza igual (no es una ruta del grupo `(admin)`, no la bloquea el layout). — verificado por estructura: `src/app/sin-acceso/page.tsx` cuelga de `app/`, no de `(admin)`, y `next build` la lista como `○ /sin-acceso` (sin el layout admin).

> AC1–AC8 quedan **pendientes de Fase 0** (migrate + `db:seed` + `sync:clerk-users`
> + alta del webhook): sin puestos en la BD todos resuelven a `customer` y no hay
> sesión real con la que recorrerlos. No se marcan sin ejecutarlos.

## Datos
Sin cambios de esquema. Sin migración.

## API
No hay rutas nuevas de API. Solo cambia el guard de auth de los 10 handlers
existentes (cuerpos y códigos de éxito/validación sin cambios):

| Método | Ruta | Permiso requerido |
|---|---|---|
| GET | `/api/admin/categories` | `categories.read` |
| POST | `/api/admin/categories` | `categories.create` |
| GET | `/api/admin/categories/[id]` | `categories.read` |
| PATCH | `/api/admin/categories/[id]` | `categories.update` |
| DELETE | `/api/admin/categories/[id]` | `categories.delete` |
| GET | `/api/admin/products` | `products.read` |
| POST | `/api/admin/products` | `products.create` |
| GET | `/api/admin/products/[id]` | `products.read` |
| PATCH | `/api/admin/products/[id]` | `products.update` |
| DELETE | `/api/admin/products/[id]` | `products.delete` |

Respuestas del guard (ya implementadas en `requirePermission`): `401 {error:"No autenticado"}`,
`403 {error:"No tenés permiso para esta acción"}`.
Nueva página: `GET /sin-acceso` (RSC, sin datos). Zod: sin schemas nuevos.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission(code)` devuelve `Guard`
  (`{ok:true,…}` | `{ok:false,response}`), `can`, `PermissionCode`. Tal cual.
- `src/lib/auth.ts:41` — `requirePanelAccess()` ya redirige a `/sin-acceso` y
  devuelve `{ clerkId, user, permissions }`. Tal cual, sin tocar el archivo.
- `src/lib/clerk-sync.ts:17` — `export type PanelMetadata = { roles: string[]; panel: boolean }`,
  para tipar el claim (`import type`, se borra en compilación).
- `src/lib/utils.ts` — `cn` para la clase activa del nav.
- `src/components/ui/button.tsx`, `card.tsx` — para `/sin-acceso`. No hace falta
  instalar componentes shadcn nuevos.
- Patrón de handler a respetar: `src/app/api/admin/categories/[id]/route.ts`
  (`resolveId`, `notFound()`, `isUniqueViolation`/`isForeignKeyViolation`).

## Decisiones técnicas
1. **Dos capas, no una.** El borde corta con un claim que puede estar viejo o
   ausente; la verdad la dan la BD (`resolvePermissions`) en layout y handlers.
   CLAUDE.md regla 8 exige ambas.
2. **`auth.protect()` devuelve el auth object** en `@clerk/nextjs@7.8.2`
   (`AuthProtect` → `SessionAuthObject`, verificado en `node_modules`), así que
   `const { sessionClaims } = await auth.protect()` evita un segundo `await auth()`.
3. **Redirect desde el middleware** con `NextResponse.redirect(new URL("/sin-acceso", request.url))`:
   `ClerkMiddlewareHandler` retorna `NextMiddlewareReturn`, que acepta `NextResponse`.
   **Solo para páginas** (review 1): en `/api/admin/**` el borde no interviene.
   `auth.protect()` allí responde `notFound()` (404 HTML, rompe el `401` JSON de
   AC6) y el redirect daría `307` a una página (rompe AC7/AC8). Matchers
   separados: `isAdminPage` corta, `isAdminApi` deja pasar al handler, que ya
   responde `401`/`403` JSON con `requirePermission`.
4. **`CustomJwtSessionClaims` se declara en `src/types/globals.d.ts`.** Por
   defecto es `{ [k: string]: unknown }`, y con `strict` no se puede leer
   `.metadata.panel`. Se declara en global, no se castea con `as`.
5. **El nav no recalcula permisos en cliente.** El server pasa los items ya
   filtrados; el client component solo marca el activo con `usePathname`.
6. **Solo `panel === false` redirige** en el borde. `undefined` (claim no
   configurado) deja pasar: falso negativo del borde, nunca falso positivo.

## Archivos afectados
| Archivo | Estado |
|---|---|
| `src/types/globals.d.ts` | nuevo |
| `src/proxy.ts` | modificado |
| `src/app/sin-acceso/page.tsx` | nuevo |
| `src/components/shared/admin-nav.tsx` | nuevo |
| `src/app/(admin)/admin/layout.tsx` | modificado |
| `src/app/api/admin/{categories,products}/route.ts` y `.../[id]/route.ts` | modificados (4) |

## Tareas
- [x] T1 — Declarar `CustomJwtSessionClaims { metadata?: PanelMetadata }` en global · `src/types/globals.d.ts` · verif: `npm run typecheck` ✓ — `import type` de `@/lib/clerk-sync` + `export {}` para que el archivo sea módulo y `declare global` aplique.
- [x] T2 — `const { sessionClaims } = await auth.protect()`; si `sessionClaims?.metadata?.panel === false` → `NextResponse.redirect("/sin-acceso")`. No tocar `isPublicRoute` ni `config.matcher` · `src/proxy.ts` · verif: `npm run typecheck` ✓ — corregido en review 1: `isAdminRoute` se partió en `isAdminPage` (`/admin(.*)`) e `isAdminApi` (`/api/admin(.*)`). El corte optimista + `auth.protect()` aplican **solo a páginas**; la API sale del middleware sin tocar (`if (isAdminApi(request)) return;`) y tampoco cae en el `!isPublicRoute` de abajo. `isPublicRoute` y `config.matcher` intactos.
- [x] T3 — Página `/sin-acceso`: título, explicación para no técnicos y botón a la tienda · `src/app/sin-acceso/page.tsx` · verif: `next build` la lista como `○ /sin-acceso` ✓ — `Card` + `Button`; el botón compone con `render={<Link href="/" />}` porque el `Button` del proyecto es Base UI y no tiene `asChild`.
- [x] T4 — `<AdminNav items={{href,label}[]} />` client component; activo con `usePathname` (`pathname.startsWith(href)`) + `cn` · `src/components/shared/admin-nav.tsx` · verif: `npm run lint` ✓ — marca el activo con `aria-current="page"` y clase `bg-accent`.
- [x] T5 — Layout admin `async`: `requirePanelAccess()` + items filtrados con `can(...)`; reemplazado el `<nav>` inline por `<AdminNav items={items} />` · `src/app/(admin)/admin/layout.tsx` · verif: typecheck/build ✓; recorrido con sesión `customer` **pendiente de Fase 0** — los items salen de `NAV_ITEMS` (href/label/permission) filtrado en el server.
- [x] T6 — Guard 401 → `requirePermission` en GET (`categories.read`) y POST (`categories.create`); import de `auth` borrado · `src/app/api/admin/categories/route.ts` · verif: `npm run typecheck && npm run lint` ✓
- [x] T7 — Ídem en GET/PATCH/DELETE (`categories.read`/`.update`/`.delete`) · `src/app/api/admin/categories/[id]/route.ts` · verif: `npm run typecheck && npm run lint` ✓
- [x] T8 — Ídem en GET (`products.read`) y POST (`products.create`) · `src/app/api/admin/products/route.ts` · verif: `npm run typecheck && npm run lint` ✓
- [x] T9 — Ídem en GET/PATCH/DELETE (`products.read`/`.update`/`.delete`) · `src/app/api/admin/products/[id]/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — validación Zod, `resolveId`, `notFound()` y códigos de error sin cambios en los 4 handlers.

Verificación final: `npm run check:rbac && npm run typecheck && npm run lint`
(el `build` lo corre el reviewer). Recorrido manual: `customer` → `/sin-acceso`;
`manager` → panel con 2 items; `DELETE` sin permiso → 403.

**Resultado de la verificación (developer, tras review 1):** `check:rbac` ✓ (`22 permisos, 6 roles,
68 filas de matriz`) · `typecheck` ✓ · `lint` ✓ (sin salida) · `build` ✓ (10 rutas,
`/sin-acceso` estática, Proxy activo). El recorrido manual con sesión real queda
**pendiente de Fase 0**: sin `db:seed` no hay puestos que probar.

## Riesgos
- **Bucle de redirect.** `/sin-acceso` debe quedar fuera del grupo `(admin)`; si
  cae dentro, su propio layout la redirige a sí misma. Es la razón de la ruta.
- **`/sin-acceso` no es pública** en `isPublicRoute`, así que exige sesión. Es
  correcto (solo se llega estando logueado), pero un anónimo que la escriba a
  mano va a `/sign-in`. No se toca `isPublicRoute` en esta fase.
- **Claim rancio.** El token vive hasta ~60 s tras un cambio de puesto: alguien
  recién degradado puede pasar el borde. El layout y los handlers lo frenan.
- **Fase 0 es prerrequisito.** Sin `db:seed`, todos resuelven al rol `customer` y
  hasta el super admin queda fuera del panel. Verificar en `db:studio` antes.
- **`resolvePermissions` está memoizado por request** (`cache()`), así que el
  guard del layout + el filtrado del nav hacen una sola query.
