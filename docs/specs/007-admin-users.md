---
id: 007
title: Gestión de personas del panel
status: done
module: auth
scope: admin
---

# 007 — Gestión de personas del panel

## Contexto
Fase 4 de la hoja de ruta RBAC. Con 006 `done`, el panel ya corta por permiso
(borde + layout + handlers), pero no existe forma de dar de alta a nadie: los
puestos solo se asignan por `db:seed` o a mano en `db:studio`. El webhook de 005
crea filas con puesto `customer` cuando alguien se registra en la tienda; no
sirve para armar el equipo.

## Objetivo
Un `super_admin` o `admin` da de alta a una persona del panel desde
`/admin/users`, le asigna un puesto y le entrega una contraseña temporal, sin
tocar la base ni el dashboard de Clerk.

## Alcance
Incluye: `/admin/users` (listado, alta, edición de nombre, reasignación de
puestos, desactivación); 4 endpoints bajo `/api/admin/users/**`; módulo
`src/modules/users/**`; extracción del catálogo RBAC puro y del shell de tabla
compartido; item "Usuarios" en el nav.
No incluye: `/admin/roles` (fase 5); `/admin/audit-logs` (fase 6); editar el
email de una persona (lo dueño Clerk); reset de contraseña o reenvío de
credenciales (deuda §Deuda); cambios en el webhook, en el seed, en
`ROLE_PERMISSIONS` o en `rbac.check.ts`; Fase 0 (migrate/seed/sync/webhook) —
prerrequisito humano.

> AC1–AC11 quedan **pendientes de Fase 0** (migrate + `db:seed` + `sync:clerk-users`
> + alta del webhook): sin puestos en la BD no hay sesión `super_admin` con la que
> recorrerlos ni puestos que asignar. No se marcan sin ejecutarlos (T24).

## Criterios de aceptación
- [ ] AC1 — Dado un `super_admin` en `/admin/users`, cuando crea a "Ana Gómez" con puesto Encargado, entonces la fila aparece con el badge "Encargado", el diálogo muestra la contraseña temporal con botón Copiar y el aviso de que no se vuelve a mostrar, y al cerrarlo no hay forma de recuperarla.
- [ ] AC2 — Dado un `admin` (sin `users.assign_admin`), cuando abre el alta o el diálogo de puestos, entonces no ve las opciones Dueño ni Administrador; y si igual hace `POST /api/admin/users` con `roleSlug:"admin"`, entonces recibe `403` y no se crea nada ni en Clerk ni en la base.
- [ ] AC3 — Dado un email que ya existe en Clerk, cuando se envía el alta, entonces la respuesta es `409`, el formulario marca el campo email con "Ya existe una persona con ese email" y no queda usuario huérfano en Clerk.
- [ ] AC4 — Dado que hay un solo `super_admin` activo, cuando se lo intenta desactivar, entonces `409 {"error":"No podés desactivar al último Dueño activo"}` y la fila sigue activa.
- [ ] AC5 — Dado un operador que se selecciona a sí mismo, cuando confirma la desactivación, entonces `409 {"error":"No podés desactivarte a vos mismo"}`.
- [ ] AC6 — Dado el alta de AC1, cuando Clerk dispara el webhook `user.created` de esa misma persona, entonces el upsert no la degrada (ya tiene puesto, AC4 de 005), no duplica la fila de `audit_logs` y la persona conserva únicamente el puesto Encargado.
- [ ] AC7 — Dada Ana con la contraseña temporal, cuando inicia sesión en `/sign-in`, entonces entra a `/admin` y el nav le muestra solo Categorías y Productos (Encargado no tiene `users.read`).
- [ ] AC8 — Dado un usuario con `dashboard.read` pero sin `users.read` (p. ej. Encargado), cuando abre `/admin`, entonces no ve el item Usuarios; y si escribe `/admin/users` a mano termina en `/sin-acceso`; y `GET /api/admin/users` le responde `403`.
- [ ] AC9 — Dado un `super_admin` que cambia el puesto de Ana de Encargado a Empleado, entonces `user_roles` queda solo con Empleado, `audit_logs` suma una fila `role.revoked` y una `role.assigned` con `actor_id` del operador, y el `publicMetadata` de Ana en Clerk refleja `roles:["employee"]`.
- [ ] AC10 — Dada Ana desactivada, cuando intenta usar su sesión abierta contra `/api/admin/products`, entonces recibe `403` (sus permisos resuelven vacío por `is_active=false`) y un nuevo intento de login lo rechaza Clerk por ban.
- [ ] AC11 — Dada cualquier alta, cuando se inspecciona `audit_logs`, entonces ninguna fila contiene la contraseña temporal en `changes` ni en `metadata`.

## Datos
Sin cambios de esquema. **Sin migración.** El listado filtra por `is_active` sobre
una tabla de decenas de filas: un índice no se justifica (se agrega el día que el
plan de `EXPLAIN` lo pida).

## API
Todos los handlers abren con `const guard = await requirePermission("<code>"); if (!guard.ok) return guard.response;`

| Método | Ruta | Permiso | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/users` | `users.read` | — (query `search`, `active`) | `200 UserWithRoles[]` · `400` query inválida |
| POST | `/api/admin/users` | `users.create` **+** `users.assign_admin` si `roleSlug ∈ {admin, super_admin}` | `createUserSchema` | `201 { user: UserWithRoles, temporaryPassword: string }` · `400` · `403` · `409` email en uso |
| PATCH | `/api/admin/users/[id]` | `users.update` si viene nombre/apellido · `users.assign_role` si viene `roleSlugs` · **+** `users.assign_admin` si el diff toca `admin`/`super_admin` | `updateUserSchema` | `200 UserWithRoles` · `400` · `403` · `404` |
| POST | `/api/admin/users/[id]/deactivate` | `users.deactivate` | — | `200 UserWithRoles` · `403` · `404` · `409` auto-baja o último Dueño |

`[id]` es `users.id` (uuid del espejo local), no el `clerkId`.
Zod en `src/modules/users/schemas/user.schema.ts`:
- `roleSlugSchema` = `z.enum(ROLES.map((r) => r.slug))` (Zod 4 acepta `readonly string[]`).
- `createUserSchema` = `{ email: z.email(), firstName?: string(≤80), lastName?: string(≤80), roleSlug: roleSlugSchema }`.
- `updateUserSchema` = `{ firstName?, lastName?, roleSlugs?: roleSlugSchema[] }` + `.refine` de "nada para actualizar".
- `assignRolesSchema` = `{ roleSlugs: roleSlugSchema[] }` (resolver del diálogo de puestos; el handler valida con `updateUserSchema`).
- `userIdSchema` = `z.uuid("Identificador inválido")`.
- `listUsersQuerySchema` = `{ search?: string(≤80), active?: z.enum(["true","false"]) }`.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission`, `can`, `PermissionCode`. Tal cual.
- `src/lib/auth.ts:41` — `requirePanelAccess()` (memoizado por request vía `cache()`): la page lo llama de nuevo sin costo.
- `src/lib/audit.ts:54` — `logAudit(tx, entry)`, `tx` obligatorio.
- `src/lib/clerk-sync.ts:107` — `syncClerkPublicMetadata(clerkId)`, se llama **fuera** de la tx.
- `src/server/repositories/user.repository.ts` — `findById`, `findByClerkId`, `upsertByClerkId`, `deactivateByClerkId`, `revokeAllRoles`, `assignRole`, `revokeRole`. Tal cual.
- `src/server/repositories/role.repository.ts` — `list`, `findBySlug`, `listSlugsByUserId`. Tal cual.
- `src/lib/api-error.ts` — `getApiErrorMessage`, `isConflict`. `src/lib/axios.ts` — `api`.
- Patrones a copiar: handler `src/app/api/admin/categories/route.ts`; módulo `src/modules/categories/**` (los 5 archivos); diálogo de confirmación `delete-category-dialog.tsx` (no hay `AlertDialog` instalado).
- Clerk `@clerk/backend@3.16.12` (verificado en `node_modules/@clerk/backend/dist/api/endpoints/UserApi.d.ts`): `createUser({ emailAddress: string[], password, firstName, lastName })` → `User`; `banUser(userId)` (revoca sesiones y **bloquea el login de forma permanente**) — no `lockUser`, que caduca en ~1 h; `deleteUser(userId)` para compensar; `isClerkAPIResponseError` desde `@clerk/backend/errors`. `clerkClient()` es async en `@clerk/nextjs@7.8.2`: `const client = await clerkClient()`.
- Instalar: `npx shadcn@latest add checkbox` (no existe en `src/components/ui/`; lo reusa la fase 5).

## Decisiones técnicas
1. **Catálogo RBAC puro en `src/lib/rbac-catalog.ts`.** `@/lib/permissions` importa `next/server` y los repositorios, y `src/server/db/index.ts` lanza si falta `DATABASE_URL` al evaluarse: no puede entrar al bundle del cliente. Se mueven `PERMISSIONS`, `ROLES`, `ROLE_PERMISSIONS`, `permissionCodesForRole`, `DEFAULT_ROLE_SLUG` y los tipos; `permissions.ts` los re-exporta (`export * from "@/lib/rbac-catalog"`), así ningún llamador actual (seed, `rbac.check.ts`, `clerk-sync.ts`, layout) cambia. El schema Zod y los diálogos importan del catálogo.
2. **`src/components/shared/data-table.tsx` se extrae ahora.** Es la 3.ª tabla y hay ~100 líneas idénticas (header, body, skeletons, vacío, paginación) en `categories-table` y `products-table`. Se extrae **solo el shell de render**: recibe `table: ReactTable<typeof features, TData>` (tipo exportado por `@tanstack/react-table@9.2.3`), `columnCount`, `isPending` y `emptyMessage`. La barra de filtros y el estado quedan en cada tabla, que es donde difieren. Migrar las dos existentes es mecánico y lo cubren `typecheck` + `build`.
3. **Un solo PATCH para perfil y puestos.** El permiso se exige por campo presente, no por endpoint. `useUpdateUser` y `useAssignRoles` son dos wrappers del mismo `PATCH`, como pide la UI.
4. **La alta revoca antes de asignar.** `createTeamMember` hace `revokeAllRoles(tx, …)` y luego `assignRole(tx, elegido)`: si el webhook `user.created` ganó la carrera y ya metió `customer`, la persona no queda con dos puestos (AC6).
5. **Compensación en Clerk.** Si `createUser` sale bien pero la transacción falla, el handler borra el usuario recién creado en Clerk (`deleteUser`, best-effort con `console.error`). Sin esto el email queda quemado y todo reintento da 409.
6. **Contraseña temporal en `src/lib/password.ts`.** 16 caracteres con `crypto.randomInt` sobre un alfabeto sin ambiguos (`0/O`, `1/l/I`), garantizando al menos una minúscula, una mayúscula, un dígito y un símbolo, y barajando el resultado. **No** se usa `skipPasswordChecks` (es para migraciones): una cadena así no cae en las listas de contraseñas filtradas. Self-check `src/lib/password.check.ts` + script `check:password`, patrón de `slug.check.ts`.
7. **Bloqueo con `banUser`, no `lockUser`.** El lock caduca solo (≈1 h por defecto); una desactivación tiene que ser permanente hasta que alguien la revierta.
8. **El conteo del último Dueño se hace dentro de la tx con `FOR UPDATE`.** Sin el lock, dos desactivaciones concurrentes leen "quedan 2" y dejan el sistema sin `super_admin`.
9. **La UI no decide la seguridad.** `canAssignAdmin` se calcula en la page (server) y viaja como prop para ocultar opciones; el handler lo re-valida siempre.

## Archivos afectados
| Archivo | Estado |
|---|---|
| `src/lib/rbac-catalog.ts` | nuevo (movimiento) |
| `src/lib/permissions.ts` | modificado (re-export) |
| `src/lib/password.ts`, `src/lib/password.check.ts` | nuevos |
| `src/lib/clerk-sync.ts` | modificado (`createTeamMember`) |
| `src/server/repositories/user.repository.ts` | modificado (`list`, `countActiveByRoleSlug`) |
| `src/app/api/admin/users/route.ts`, `[id]/route.ts`, `[id]/deactivate/route.ts` | nuevos |
| `src/modules/users/{types,schemas,services,hooks,components}/**` | nuevos (9) |
| `src/components/shared/data-table.tsx` | nuevo |
| `src/modules/{categories,products}/components/*-table.tsx` | modificados (migración) |
| `src/components/ui/checkbox.tsx` | nuevo (shadcn CLI) |
| `src/app/(admin)/admin/users/page.tsx` | nuevo |
| `src/app/(admin)/admin/layout.tsx` | modificado (item de nav) |
| `package.json` | modificado (`check:password`) |

## Tareas
- [x] T1 — Mover el catálogo puro (`PERMISSIONS`, `ROLES`, `ROLE_PERMISSIONS`, `permissionCodesForRole`, `DEFAULT_ROLE_SLUG`, `PermissionCode`, `RoleSlug`) y re-exportarlo desde `permissions.ts` · `src/lib/rbac-catalog.ts` · verif: `npm run check:rbac && npm run typecheck` ✓ — `rbac-catalog.ts` no tiene ni un import (dato puro); `permissions.ts` queda con `export * from "@/lib/rbac-catalog"` + la resolución en runtime. Seed, `rbac.check.ts`, `clerk-sync.ts` y el layout compilan sin tocarlos.
- [x] T2 — `generateTemporaryPassword()` con `node:crypto` · `src/lib/password.ts` · verif: `npm run typecheck` ✓ — 16 chars con `randomInt` (CSPRNG), alfabeto sin `0/O/1/l/I`, una de cada clase + Fisher-Yates.
- [x] T3 — Self-check de la contraseña (longitud, 4 clases presentes, 1000 muestras sin repetir) + script `check:password` · `src/lib/password.check.ts`, `package.json` · verif: `npm run check:password` ✓ — `password: ok — 1000 muestras, 16 chars, 4 clases, sin repetidos`; también verifica que el primer caracter esté barajado.
- [x] T4 — `list(filters?: { id?, search?, isActive? })` con join `users→user_roles→roles`, filas planas agrupadas en `UserWithRoles[]`, orden `desc(users.createdAt)` · `src/server/repositories/user.repository.ts` · verif: `npm run typecheck` ✓ — `LEFT JOIN` a `user_roles`/`roles` (quien no tiene puesto igual aparece), filtros `id`/`search` (ilike sobre email, nombre y apellido)/`isActive`, agrupado con un `Map` que conserva el orden `desc(createdAt)`.
- [x] T5 — `countActiveByRoleSlug(tx, slug)` con `.for("update")` sobre `users` · mismo archivo · verif: `npm run typecheck` ✓ — `.for("update", { of: users })`; cuenta filas en JS porque Postgres no admite `FOR UPDATE` con agregados.
- [x] T6 — Schemas Zod del módulo · `src/modules/users/schemas/user.schema.ts` · verif: `npm run typecheck` ✓ — importa `ROLES` de `@/lib/rbac-catalog` (T1), no de `@/lib/permissions`.
- [x] T7 — `export type { User, Role }` + `UserWithRoles = User & { roles: Role[] }` · `src/modules/users/types/user.ts` · verif: `npm run lint` ✓ — `UserWithRoles = User & { roles: Role[] }`; lo consume también `user.repository.list()` (`import type`, se borra en compilación).
- [x] T8 — `createTeamMember(input, { actorId })`: password → `clerkClient().users.createUser` → tx (`upsertByClerkId` + `revokeAllRoles` + `assignRole` + `logAudit("user.created")`) → `syncClerkPublicMetadata` fuera de la tx; compensa con `deleteUser` si la tx falla; devuelve `{ user, temporaryPassword }` · `src/lib/clerk-sync.ts` · verif: `npm run typecheck` ✓ — el rol se resuelve **antes** de tocar Clerk (si falta, no hay nada que compensar); la contraseña no entra a `changes` ni a `metadata`.
- [x] T9 — `GET` (`users.read`, query validada) y `POST` (`users.create` + chequeo extra de `users.assign_admin`; `409` mapeando `isClerkAPIResponseError` con identificador en uso) · `src/app/api/admin/users/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — `409` cuando algún `error.errors[].code === "form_identifier_exists"`; el chequeo de `users.assign_admin` corre antes de crear nada.
- [x] T10 — `PATCH`: valida `userIdSchema` + `updateUserSchema`, exige el permiso de cada campo presente, diff de puestos → `assignRole`/`revokeRole` + `logAudit("role.assigned"/"role.revoked")` en una tx, luego `syncClerkPublicMetadata` · `src/app/api/admin/users/[id]/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — abre con `requirePermission("users.read")` (puerta mínima: autentica y resuelve permisos) y exige `users.update`/`users.assign_role`/`users.assign_admin` por campo presente. Sumé `updateProfile(tx, id, …)` al repo: el handler no puede escribir en la BD.
- [x] T11 — `POST .../deactivate`: rechaza auto-baja y último Dueño (`409`), tx con `deactivateByClerkId` + `revokeAllRoles` + `logAudit("user.deleted", severity:"warning")`, luego `banUser` + `syncClerkPublicMetadata` · `src/app/api/admin/users/[id]/deactivate/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — el conteo del último Dueño va dentro de la tx; `banUser` es best-effort con `console.error` (la baja ya commiteó y sus permisos resuelven vacío).
- [x] T12 — Wrappers axios `listUsers`/`createUser`/`updateUser`/`assignRoles`/`deactivateUser`, `BASE_URL="/admin/users"` · `src/modules/users/services/user.service.ts` · verif: `npm run typecheck` ✓ — `assignRoles` y `updateUser` pegan al mismo `PATCH` (decisión 3); `createUser` devuelve `{ user, temporaryPassword }`.
- [x] T13 — Hooks con `usersKey = ["users"]` e invalidación en `onSuccess` (sin toasts) · `src/modules/users/hooks/use-users.ts` · verif: `npm run lint` ✓ — `useUsers`, `useCreateUser`, `useUpdateUser`, `useAssignRoles`, `useDeactivateUser`; los toasts quedan en los diálogos.
- [x] T14 — `npx shadcn@latest add checkbox` · `src/components/ui/checkbox.tsx` · verif: `npm run lint` ✓ — creado por el CLI (Base UI: `checked` + `onCheckedChange`), sin tocarlo a mano.
- [x] T15 — Shell genérico de tabla (header, body, skeletons, vacío, paginación) · `src/components/shared/data-table.tsx` · verif: `npm run typecheck` ✓ — el shell exporta también `tableShellFeatures`: sin la config de features el tipo `ReactTable<TFeatures, TData>` no expone `getCanSort` ni la paginación, así que es parte del contrato. Incluye el `aria-sort` que hasta ahora solo tenía productos.
- [x] T16 — Migrar `categories-table.tsx` al shell, sin cambiar columnas ni filtros · verif: `npm run typecheck && npm run build` ✓ — solo cambió el render: columnas, filtros, estado y mensajes idénticos. `typecheck` ✓ `build` ✓.
- [x] T17 — Migrar `products-table.tsx` al shell, conservando `ARIA_SORT` y los dos filtros (AC10 de 003) · verif: `npm run typecheck && npm run build` ✓ — `ARIA_SORT` vive ahora en el shell y los dos `<Select>` con `setFilter`/`filterValue` quedaron intactos. `typecheck` ✓ `build` ✓.
- [x] T18 — Tabla de personas: nombre (`—` si falta), email, puestos (badges con `role.name`), estado, acciones; búsqueda + filtro por estado · `src/modules/users/components/users-table.tsx` · verif: `npm run lint` ✓ — columnas armadas con `useMemo([canAssignAdmin])` porque el prop viaja hasta el diálogo de puestos; "Desactivar" no se ofrece en filas ya inactivas.
- [x] T19 — Alta: RHF + `zodResolver(createUserSchema)`, `<Select>` con `ROLES[].name`/`.description` filtrado por `canAssignAdmin`, panel de contraseña con Copiar y aviso, `setError("email")` en `409` · `src/modules/users/components/user-form-dialog.tsx` · verif: `npm run lint` ✓ — tras el `201` el diálogo cambia a un panel con email + contraseña y botón Copiar; al cerrar se limpia el estado y no hay forma de recuperarla. Puesto por defecto `employee` (menor privilegio).
- [x] T20 — Editar nombre y apellido (el email no se toca) · `src/modules/users/components/edit-user-dialog.tsx` · verif: `npm run lint` ✓ — el email se muestra `readOnly` (lo dueña Clerk).
- [x] T21 — Checkboxes de puestos (sin `customer`) con nombre + descripción; oculta Dueño/Administrador si `!canAssignAdmin` · `src/modules/users/components/assign-roles-dialog.tsx` · verif: `npm run lint` ✓ — los slugs iniciales salen del catálogo filtrando por `user.roles`, así quedan tipados sin `as`.
- [x] T22 — Confirmación de baja con el texto "La persona pierde el acceso al panel de inmediato" · `src/modules/users/components/deactivate-user-dialog.tsx` · verif: `npm run lint` ✓ — texto exacto del spec + aviso de que no se reactiva desde el panel (deuda).
- [x] T23 — Page con guard `users.read` → `/sin-acceso`, `canAssignAdmin` derivado de `can(permissions, "users.assign_admin")`, botón "Invitar persona"; item "Usuarios" en `NAV_ITEMS` del layout · `src/app/(admin)/admin/users/page.tsx`, `src/app/(admin)/admin/layout.tsx` · verif: `npm run build` ✓ — la page repite el guard (`users.read` → `/sin-acceso`) porque el layout solo exige `dashboard.read`; `build` lista `/admin/users` como ƒ.
- [ ] T24 — **PAUSA: validación humana.** Con `npm run dev` y Fase 0 hecha: recorrer AC1–AC11 con sesión `super_admin`, con la persona recién creada y con un `admin` de prueba. No se marca sin ejecutarlo.

Verificación final: `npm run check:rbac && npm run check:password && npm run typecheck && npm run lint`
(el `build` lo corre el reviewer).

**Resultado de la verificación (developer):** `check:rbac` ✓ (`22 permisos, 6 roles,
68 filas de matriz`) · `check:password` ✓ (`1000 muestras, 16 chars, 4 clases`) ·
`typecheck` ✓ · `lint` ✓ (sin salida) · `build` ✓ (16 rutas; `/admin/users` y los
3 endpoints nuevos aparecen como ƒ, y el bundle de cliente compila: `rbac-catalog`
no arrastra `@/server/db`). T24 queda **sin ejecutar**: requiere Fase 0.

**Desvíos del plan, todos menores:**
1. `updateProfile(tx, id, {firstName,lastName})` sumado a `user.repository.ts`: el
   PATCH tiene que escribir el nombre y las consultas van en el repositorio.
2. `ADMIN_ROLE_SLUGS` y `assignableRoles(canAssignAdmin)` viven en
   `rbac-catalog.ts`: eran la misma lista repetida en 2 handlers y 2 diálogos.
3. El shell exporta `tableShellFeatures` (ver T15) y las 3 tablas lo importan.
4. El PATCH abre con `requirePermission("users.read")` como puerta mínima para
   devolver `401` antes de mirar el body; los permisos por campo se exigen abajo
   con `can(...)`, tal cual la tabla de API.
5. El alta y el diálogo de puestos no ofrecen `customer` (es del storefront, lo
   asigna el webhook). El spec lo pedía explícito solo para T21.
**Review 1 (3 hallazgos, corregidos):**
- MAYOR — el PATCH revocaba `super_admin` sin guard y podía dejar el sistema sin
  Dueño. Ahora, dentro de la misma tx y **antes de escribir**, si `toRevoke`
  incluye `super_admin` cuenta con `countActiveByRoleSlug(tx, …)` (`FOR UPDATE`) y
  aborta con `409 {"error":"No podés quitar el último Dueño"}`, espejando la baja.
- MENOR — el desvío sobre el nombre en Clerk pasó a §Deuda aceptada.
- MENOR — `UsersTable` recibe `canUpdate` (derivado en la page de
  `can(permissions, "users.update")`) y oculta el trigger de edición si es `false`.

## Riesgos
- **Carrera con el webhook.** `createUser` en Clerk dispara `user.created` antes de que commitee la tx del panel. Si el webhook gana, inserta la fila y le pone `customer`; el `revokeAllRoles` de la decisión 4 lo corrige. Si gana el panel, el webhook ve `slugs.length > 0`, no asigna nada y su `upsertByClerkId` devuelve `created:false`, así que tampoco duplica la traza. Queda una ventana mínima: `listSlugsByUserId` del webhook lee con `db`, fuera de su transacción, y podría ver la foto vieja; el peor caso es un `customer` sobrante, que no otorga ningún permiso.
- **Usuario huérfano en Clerk.** Cubierto por la compensación (decisión 5), pero si también falla el `deleteUser`, ese email queda tomado en Clerk sin fila local. Se detecta porque el alta responde `409` para un email que no aparece en `/admin/users`; se limpia desde el dashboard de Clerk.
- **La contraseña temporal viaja en el body de la respuesta y vive solo en memoria del cliente.** No se persiste, no se audita (AC11) y no hay forma de recuperarla: si el operador cierra el diálogo sin copiarla, hay que borrar la persona y volver a crearla hasta que exista el reset (deuda).
- **`banUser` puede fallar después de commitear la tx.** La base ya dice `is_active=false`, así que `listCodesByClerkId` devuelve vacío y la persona no pasa ningún `requirePermission`; conserva la sesión de Clerk pero no puede hacer nada en el panel. Se registra con `console.error` y se reintenta desactivando de nuevo.
- **`updateUserMetadata` reemplaza, no fusiona.** `syncClerkPublicMetadata` ya escribe el objeto `PanelMetadata` completo, así que está bien; no agregar claves sueltas ahí.
- **Fase 0 sigue siendo prerrequisito.** Sin `db:seed` no hay puestos que asignar y el propio `super_admin` no entra al panel.

## Deuda aceptada
- El `PATCH` no replica nombre y apellido en Clerk: se guardan solo en el espejo
  local. Un `user.updated` posterior de Clerk revierte el nombre editado desde el
  panel. Se resuelve con un `users.updateUser(clerkId, …)` en el handler.
- Sin reset de contraseña ni "reenviar credenciales" para alguien ya creado: por ahora se resuelve con el flujo de recuperación de Clerk en `/sign-in`. Candidato a la fase 7.
- Sin reactivación de una persona desactivada (requiere `unbanUser` + reasignar puesto).
- Sin paginación de servidor en `GET /api/admin/users`: pagina TanStack Table en cliente, igual que categorías y productos.
