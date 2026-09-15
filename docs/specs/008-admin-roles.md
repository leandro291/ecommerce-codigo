---
id: 008
title: Editor de puestos y permisos
status: done
module: auth
scope: admin
---

# 008 — Editor de puestos y permisos

## Contexto
Fase 5 de la hoja de ruta RBAC. Con 006 y 007 `done`, el panel corta por permiso
y ya se dan de alta personas, pero la matriz puesto→permiso solo se cambia con
`db:seed` o a mano en `db:studio`. El runtime **ya lee de la base**
(`resolvePermissions` → `permission.repository.listCodesByClerkId`, join con
`role_permissions`), así que alcanza con editar filas: sin migración.

## Objetivo
El Dueño (`super_admin`) ajusta desde `/admin/roles` qué permite cada puesto
marcando permisos en lenguaje claro, y cada cambio queda auditado en la misma
transacción. Quien tenga `roles.read` lo consulta sin poder editar.

## Alcance
Incluye: `/admin/roles` (lectura para `roles.read`, edición para `roles.update`);
`GET /api/admin/roles` y `PATCH /api/admin/roles/[id]`; módulo
`src/modules/roles/**`; resincronización de `publicMetadata` cuando el cambio
toca `dashboard.read`; item "Puestos" en el nav; comentario de
`ROLE_PERMISSIONS` como semilla.
No incluye: crear, renombrar o borrar puestos (los 6 son de sistema); editar el
catálogo de permisos (`permissions` es tabla semilla, SETUP §5.1 regla 4);
`/admin/audit-logs` (fase 6 — consume los eventos `role.permission_*` que genera
este spec); reconciliación destructiva del seed; cambios en `resolvePermissions`,
`requirePermission` o `src/server/db/seed.ts`; Fase 0 (migrate/seed/sync/webhook)
— prerrequisito humano.

> AC1–AC11 quedan **pendientes de Fase 0**: sin puestos en la BD no hay sesión
> `super_admin` con la que recorrerlos. No se marcan sin ejecutarlos (T14).

## Criterios de aceptación
- [ ] AC1 — Dado el Dueño en `/admin/roles`, cuando destilda "Eliminar productos" del puesto Encargado y guarda, entonces esa fila desaparece de `role_permissions`, `audit_logs` suma una fila `role.permission_revoked` con `actor_id` del Dueño y `entity_id` del puesto, y un Encargado con sesión abierta recibe `403` en su siguiente `DELETE /api/admin/products/[id]`.
- [ ] AC2 — Dado un `admin` (tiene `roles.read`, no `roles.update`), cuando abre `/admin/roles`, entonces ve las 6 tarjetas con el resumen legible y ningún checkbox ni botón "Editar permisos".
- [ ] AC3 — Dado ese mismo `admin`, cuando hace `PATCH /api/admin/roles/[id]` a mano, entonces recibe `403 {"error":"No tenés permiso para esta acción"}` y ninguna fila de `role_permissions` cambia.
- [ ] AC4 — Dado el Dueño, cuando hace `PATCH` sobre el puesto `super_admin`, entonces recibe `409` con mensaje claro, no se toca ninguna fila y no se audita nada; y en la UI esa tarjeta no ofrece botón de edición.
- [ ] AC5 — Dado un `PATCH` con `permissionCodes:["products.fly"]`, entonces la respuesta es `400 {"error":"Datos inválidos", issues:[…]}` y no se escribe nada.
- [ ] AC6 — Dado un `PATCH` con exactamente los permisos que el puesto ya tiene, entonces la respuesta es `200`, `role_permissions` queda igual y `audit_logs` no suma filas.
- [ ] AC7 — Dado un usuario con puesto Auditoría, cuando abre `/admin/roles`, entonces ve la lista completa en modo lectura (tiene `roles.read`).
- [ ] AC8 — Dado un Empleado (sin `roles.read`), cuando abre `/admin`, entonces el nav no muestra "Puestos"; si escribe `/admin/roles` termina en `/sin-acceso`; y `GET /api/admin/roles` le responde `403`.
- [ ] AC9 — Dado que el Dueño le agrega `dashboard.read` al puesto Empleado, cuando el `PATCH` responde `200`, entonces el `publicMetadata.panel` de cada usuario con ese puesto queda en `true` en Clerk y esos usuarios entran a `/admin` sin quedar rebotados en el borde.
- [ ] AC10 — Dado un `PATCH` a un uuid válido que no existe, entonces la respuesta es `404 {"error":"Puesto no encontrado"}`.
- [ ] AC11 — Dado el Dueño destildando "Acceder al panel de administración" de un puesto, cuando lo hace, entonces el diálogo muestra una advertencia visible y, si confirma, el guardado procede con `200` (la decisión es suya).

## Datos
**Sin cambios de esquema. Sin migración.** Editar = `INSERT`/`DELETE` sobre
`role_permissions` (PK compuesta `(role_id, permission_id)`, ambas FK
`ON DELETE CASCADE`). `roles` y `permissions` no se tocan.

## API
Ambos handlers abren con `const guard = await requirePermission("<code>"); if (!guard.ok) return guard.response;`

| Método | Ruta | Permiso | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/roles` | `roles.read` | — | `200 RolesPageData` |
| PATCH | `/api/admin/roles/[id]` | `roles.update` | `updateRolePermissionsSchema` | `200 RoleWithPermissions` · `400` · `403` · `404` · `409` puesto Dueño |

`RolesPageData = { roles: RoleWithPermissions[], permissions: Permission[] }`,
donde `RoleWithPermissions = Role & { permissionCodes: PermissionCode[] }` y
`permissions` es el catálogo completo (22 filas de `permission.repository.list()`,
con `code`, `description`, `resource`, `action`).

Zod en `src/modules/roles/schemas/role.schema.ts` (importa de
`@/lib/rbac-catalog`, **no** de `@/lib/permissions`: arrastra `next/server` y la
BD al bundle del cliente — decisión 1 del spec 007):
- `permissionCodeSchema` = `z.enum(PERMISSIONS.map((p) => p.code))`.
- `updateRolePermissionsSchema` = `{ permissionCodes: permissionCodeSchema[] }` (el handler deduplica con `new Set`).
- `roleIdSchema` = `z.uuid("Identificador inválido")`.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission`, `can`, `Guard` (`guard.user` es `User | null` → `actorId = guard.user?.id ?? null`). Tal cual.
- `src/lib/auth.ts:41` — `requirePanelAccess()`, memoizado por request; la page lo vuelve a llamar sin costo.
- `src/lib/audit.ts:54` — `logAudit(tx, entry)`, `tx` obligatorio; `AuditChanges = { before?, after? }`.
- `src/lib/rbac-catalog.ts` — `PERMISSIONS`, `ROLES`. Dato puro, apto para cliente.
- `src/lib/clerk-sync.ts:198` — `syncClerkPublicMetadata(clerkId)`; deriva `panel` de `dashboard.read` en la BD. Se llama **fuera** de la tx.
- `src/server/repositories/permission.repository.ts` — `list()` (catálogo ordenado por `code`). Tal cual.
- `src/server/db/index.ts` — `db.transaction()`, `type Tx`.
- `src/components/ui/{card,checkbox,dialog,button,badge}.tsx` — ya instalados (checkbox llegó en 007). **No hace falta instalar nada.** Son Base UI: `render={<X/>}`, no `asChild`; el checkbox usa `checked` + `onCheckedChange`.
- Patrones a copiar: handler `[id]` `src/app/api/admin/users/[id]/route.ts` (`RouteContext<"…">`, validación de id, tx + `logAudit`, `console.error` + 500); módulo `src/modules/users/**` (service con `BASE_URL`, hook con `usersKey` + invalidación, toasts en el componente); page `src/app/(admin)/admin/users/page.tsx` (guard propio + props de capacidad).
- `src/components/shared/data-table.tsx` **no aplica**: son 6 tarjetas, no una tabla.

## Decisiones técnicas
1. **`ROLE_PERMISSIONS` pasa a ser semilla de arranque.** El runtime ya lee
   `role_permissions`; a partir de acá la constante solo alimenta `db:seed`
   (`onConflictDoNothing`, no revoca) y los asserts de `rbac.check.ts`. Se ajusta
   el **comentario** de ambos archivos. Los conteos (22/20/12/6/8/0, 68 filas) y
   el assert "admin no tiene `roles.update`" siguen vigentes: validan la semilla.
   Los números **no cambian**.
2. **El diff vive en el repositorio.** `setPermissions(tx, roleId, desiredCodes)`
   lee lo actual, resuelve `permissionId` por `code`, inserta y borra, y devuelve
   `{ granted, revoked }`. El handler solo audita lo devuelto: sin `SELECT`
   sueltos en el handler (CLAUDE.md regla 3) y sin ventana entre leer y escribir.
3. **Auditoría bloqueante, una fila por permiso cambiado.** `logAudit` va dentro
   de la misma `db.transaction()`: si falla el log, revierte la mutación
   (SETUP §5.2 regla 4). `role.permission_granted` → `changes.after.permissionCode`;
   `role.permission_revoked` → `changes.before.permissionCode`; ambos con
   `entityType:"role"`, `entityId: role.id`, `metadata:{ roleSlug, source:"admin-panel" }`
   y `severity:"warning"`.
4. **`super_admin` no se edita.** Es `"*"`: todos los permisos, presentes y
   futuros. `409`, no `403`: el Dueño **tiene** el permiso, es el estado del
   recurso lo que no lo admite. La comparación `role.slug === "super_admin"`
   identifica la fila objetivo, no autoriza nada — la autorización la sigue
   dando `requirePermission("roles.update")` (CLAUDE.md regla 8).
5. **`isSystem` no bloquea acá.** Protege renombrar/borrar el puesto, fuera de
   alcance. Los 6 puestos son de sistema; si `isSystem` bloqueara, la feature no
   existiría.
6. **Resincronizar Clerk solo si el diff toca `dashboard.read`.** `publicMetadata`
   guarda `{roles, panel}`, no la lista de permisos: cambiar `products.delete` no
   afecta a Clerk. Pero `panel` sí se deriva de `dashboard.read`, y un `panel:false`
   rancio es un **falso positivo del borde**: `proxy.ts` rebotaría para siempre a
   quien acaba de ganar el acceso. Por eso, y solo en ese caso, tras commitear se
   recorren los `clerkId` de ese puesto y se llama `syncClerkPublicMetadata`
   (best-effort, `console.error`). El caso inverso (perdió el panel, claim dice
   `true`) es seguro: lo frena `requirePanelAccess()` en el layout.
7. **Un puesto puede quedar sin `dashboard.read`.** El handler no lo impide; la
   UI advierte (AC11). Es una decisión de negocio del Dueño, no un invariante.
8. **La UI no decide la seguridad.** `canEdit` se calcula en la page (server) y
   viaja como prop; el `PATCH` lo revalida siempre con `requirePermission`.
9. **Etiquetas humanas en un solo lugar.** `permission-groups.ts` agrupa por
   `resource` y traduce `resource`/`action` al español; lo consumen la lista y el
   diálogo. Nunca se muestra un `code` al usuario.

## Archivos afectados
| Archivo | Estado |
|---|---|
| `src/lib/rbac-catalog.ts`, `src/lib/rbac.check.ts` | modificados (solo comentarios) |
| `src/server/repositories/role.repository.ts` | modificado (`findById`, `listPermissionCodesByRole`, `setPermissions`) |
| `src/server/repositories/user.repository.ts` | modificado (`listClerkIdsByRoleId`) |
| `src/app/api/admin/roles/route.ts`, `.../[id]/route.ts` | nuevos |
| `src/modules/roles/{types,schemas,services,hooks,lib,components}/**` | nuevos (7) |
| `src/app/(admin)/admin/roles/page.tsx` | nuevo |
| `src/app/(admin)/admin/layout.tsx` | modificado (item de nav) |

## Tareas
- [x] T1 — Actualizar el comentario de cabecera: `ROLE_PERMISSIONS` es semilla de arranque, la verdad en runtime es `role_permissions`; los asserts validan la semilla. Sin cambiar datos ni números · `src/lib/rbac-catalog.ts`, `src/lib/rbac.check.ts` · verif: `npm run check:rbac` ✓ — tres bloques de comentario (cabecera del catálogo, `ROLE_PERMISSIONS` y cabecera del check). Ni un dato, número ni assert tocado: la salida sigue siendo `22 permisos, 6 roles, 68 filas de matriz, redacción activa`.
- [x] T2 — `findById(id)` y `listPermissionCodesByRole(): Promise<Map<roleId, PermissionCode[]>>` (una sola query con join a `permissions`, evita el N+1 de 6 lecturas) · `src/server/repositories/role.repository.ts` · verif: `npm run typecheck` ✓ — el `PermissionCode` se importa de `@/lib/rbac-catalog` (dato puro, sin ciclo con `@/lib/permissions`) y la query ordena por `permissions.code`, así el resumen de cada tarjeta sale estable.
- [x] T3 — `setPermissions(tx, roleId, desiredCodes): Promise<{granted, revoked}>` — lee lo actual, resuelve ids por `code` (throw con "falta correr npm run db:seed" si falta alguno), `insert` de los nuevos y `delete` de los quitados · mismo archivo · verif: `npm run typecheck` ✓ — un solo `SELECT` del catálogo resuelve id-por-código **y** valida los deseados; el `DELETE` va acotado con `and(roleId, inArray(permissionId, …))`. Sin `!`: los ids se resuelven con un `filter` type-guard. `insert`/`delete` se saltean si el lado correspondiente del diff está vacío (AC6: diff vacío = cero escrituras).
- [x] T4 — `listClerkIdsByRoleId(roleId): Promise<string[]>` sobre `user_roles`, solo activos · `src/server/repositories/user.repository.ts` · verif: `npm run typecheck` ✓ — `innerJoin` a `users` con `is_active = true`: a alguien dado de baja no le cambia nada (sus permisos ya resuelven vacío) y sería una llamada a Clerk al pedo.
- [x] T5 — Schemas Zod (`permissionCodeSchema`, `updateRolePermissionsSchema`, `roleIdSchema`) · `src/modules/roles/schemas/role.schema.ts` · verif: `npm run typecheck` ✓ — importa `PERMISSIONS` de `@/lib/rbac-catalog`, no de `@/lib/permissions` (decisión 1 del 007). `products.fly` no está en el enum → `400` (AC5).
- [x] T6 — `export type { Role, Permission } from "@/server/db/schema"` + `RoleWithPermissions` y `RolesPageData` · `src/modules/roles/types/role.ts` · verif: `npm run lint` ✓ — único punto de contacto del módulo con `server/`, y es `import type`: se borra en compilación.
- [x] T7 — `GET`: guard `roles.read`, arma `RolesPageData` con `role.list()` + `listPermissionCodesByRole()` + `permission.list()` · `src/app/api/admin/roles/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — las tres lecturas van en un `Promise.all`; un puesto sin filas en la matriz queda con `permissionCodes: []` (no desaparece).
- [x] T8 — `PATCH`: valida id y body, `404` si no existe, `409` si es `super_admin`, tx con `setPermissions` + un `logAudit` por permiso cambiado, resync de Clerk fuera de la tx solo si el diff toca `dashboard.read` · `src/app/api/admin/roles/[id]/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — orden exacto: guard → id → body (dedup con `new Set`) → `findById` → `409` del Dueño **antes** de abrir la tx (no toca filas ni audita, AC4). `logAudit` va dentro de la tx y es bloqueante (decisión 3). El resync recorre `listClerkIdsByRoleId` uno por uno con `try/catch` + `console.error`: un fallo no rompe la respuesta.
- [x] T9 — Wrappers axios `listRoles()` / `updateRolePermissions(id, permissionCodes)`, `BASE_URL="/admin/roles"` · `src/modules/roles/services/role.service.ts` · verif: `npm run typecheck` ✓ — mismo patrón que `user.service.ts`.
- [x] T10 — `rolesKey = ["roles"]`, `useRoles()`, `useUpdateRolePermissions()` (invalida en `onSuccess`, sin toasts) · `src/modules/roles/hooks/use-roles.ts` · verif: `npm run lint` ✓ — `useRoles` sin parámetros: el `GET` no tiene filtros, así que la key es la constante.
- [x] T11 — `RESOURCE_LABELS`, `ACTION_LABELS` y `groupByResource(permissions)` con fallback al segmento crudo si el catálogo crece · `src/modules/roles/lib/permission-groups.ts` · verif: `npm run typecheck` ✓ — 8 recursos y 8 acciones traducidos; el fallback (`humanize`) reemplaza `_` por espacio, así un `code` nuevo sin etiqueta se lee igual. Expone además `resourceLabel`/`actionLabel`, que es lo que consume el resumen de las tarjetas.
- [x] T12 — Una `Card` por puesto: nombre, descripción, resumen agrupado por recurso ("Productos: ver, crear, editar"), y botón "Editar permisos" o badge "Solo el Dueño puede editar" según `canEdit`; estados de carga y error · `src/modules/roles/components/roles-list.tsx` · verif: `npm run lint` ✓ — carga: 6 `Card` con `Skeleton`; error: mensaje + "Reintentar" (mismo patrón que las tablas). La tarjeta del Dueño nunca ofrece edición: muestra el badge "Todos los permisos" aunque `canEdit` sea `true` (AC4). Vacío: avisa que falta `db:seed`.
- [x] T13 — Diálogo con checkboxes agrupados por recurso etiquetados con `permission.description`, advertencia si se destilda `dashboard.read`, guardar → mutación + toast + cerrar · `src/modules/roles/components/role-permissions-dialog.tsx` · verif: `npm run lint` ✓ — `useState` en vez de RHF: no hay validación de cliente que hacer (el enum sale del catálogo y el handler revalida). Al abrir se resetea a la foto del servidor. La advertencia (`role="alert"`) aparece solo si el puesto **tenía** `dashboard.read` y quedó destildado, y no bloquea el guardado (AC11, decisión 7).
- [x] T14 — Page con guard `roles.read` → `/sin-acceso` y `canEdit` derivado; item "Puestos" en `NAV_ITEMS` · `src/app/(admin)/admin/roles/page.tsx`, `src/app/(admin)/admin/layout.tsx` · verif: `npm run build` ✓ — la page repite el guard porque el layout solo exige `dashboard.read`; `build` lista `/admin/roles` como ƒ.
- [ ] T15 — **PAUSA: validación humana.** Con Fase 0 hecha y `npm run dev`: recorrer AC1–AC11 con sesiones `super_admin`, `admin`, `audit` y `employee`. No se marca sin ejecutarlo.

Verificación final: `npm run check:rbac && npm run typecheck && npm run lint`
(el `build` lo corre el reviewer).

**Resultado de la verificación (developer):** `check:rbac` ✓ (`22 permisos, 6 roles,
68 filas de matriz, redacción activa` — misma salida que antes de T1) · `typecheck` ✓ ·
`lint` ✓ (sin salida) · `build` ✓ (18 rutas; `/admin/roles`, `/api/admin/roles` y
`/api/admin/roles/[id]` aparecen como ƒ, y el bundle de cliente compila: los
schemas y el diálogo importan de `rbac-catalog`, que no arrastra `@/server/db`).
**T15 queda sin ejecutar y AC1–AC11 sin marcar: requieren Fase 0** (migrate +
`db:seed` + `sync:clerk-users` + alta del webhook), que no está aplicada. Sin
puestos en la BD no hay sesión `super_admin` con la que recorrerlos.

**Desvíos del plan, todos menores:**
1. `permission-groups.ts` exporta también `resourceLabel(resource)` y
   `actionLabel(action)`: el resumen de la tarjeta necesita la etiqueta de acción
   suelta y el fallback tiene que vivir en un solo lugar.
2. `setPermissions` devuelve `granted`/`revoked` ordenados alfabéticamente, para
   que el orden de las filas de `audit_logs` sea determinista.
3. El `PATCH` responde con `{...role, permissionCodes: desired.sort()}` en vez de
   releer la matriz: después del commit, lo deseado **es** el estado, y ahorra una
   query. La UI igual invalida `rolesKey` y refetchea.
4. Se borraron los `.gitkeep` de las carpetas de `src/modules/roles/` que quedaron
   con archivos (queda el de `store/`, que sigue vacía).

## Riesgos
- **Ventana del claim.** Tras un cambio, el token de sesión conserva el
  `metadata` viejo hasta que Clerk lo refresque (~60 s). El borde puede dejar
  pasar a alguien que perdió `dashboard.read`; el layout server lo frena en el
  mismo request. El caso peligroso (ganó el panel pero el claim dice `false`) lo
  cubre el resync de la decisión 6, aunque también tarda ese refresco.
- **Auto-bloqueo del Dueño imposible por diseño**: `super_admin` no es editable,
  así que nadie puede quitarse `roles.update` a sí mismo y dejar el sistema sin
  quien edite la matriz. Sí puede dejar sin panel a otros puestos (AC11).
- **`setPermissions` no toma lock sobre el puesto.** Dos ediciones concurrentes
  del mismo rol: la última gana, y la auditoría de la primera queda registrada
  igual. Con un solo Dueño editando es aceptable; si algún día hay varios,
  agregar `SELECT … FOR UPDATE` sobre `roles` al abrir la tx.
- **Fase 0 sigue siendo prerrequisito.** Sin `db:seed` no hay puestos ni permisos
  que listar y el `GET` devuelve vacío.

## Deuda aceptada
- Sin crear, renombrar ni borrar puestos: los 6 son fijos.
- Sin "restaurar valores por defecto" de un puesto (volver a `ROLE_PERMISSIONS`).
  Se resuelve manualmente destildando, y queda auditado igual.
- El resync de Clerk es best-effort: si falla para algún usuario, su `panel`
  queda rancio hasta el próximo evento suyo. Se detecta porque ese usuario rebota
  en `/sin-acceso` pese a tener el permiso; se arregla con `npm run sync:clerk-users`.
