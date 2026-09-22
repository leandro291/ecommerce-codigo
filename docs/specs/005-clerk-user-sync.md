---
id: 005
title: Sincronización de usuarios con Clerk (webhook + backfill)
status: done
module: auth
scope: both
created: 2026-08-31
---

# 005 — Sincronización de usuarios con Clerk (webhook + backfill)

## 1. Contexto

La fase 1 (`docs/specs/004-rbac-foundations.md`) dejó el esquema RBAC, el seed y
los helpers de servidor. La tabla `users` está **vacía salvo la fila del super
admin**: `getCurrentUser()` devuelve `user: null` para todos y
`resolvePermissions()` cae al fallback `customer` (0 permisos). Sin esta fase, la
fase 3 dejaría el panel inaccesible para todo el mundo (004 §10).

Verificado en el repo:

- `src/proxy.ts:9` ya tiene `/api/webhooks(.*)` en `isPublicRoute`. **Sin cambios
  de matcher ni de `config.matcher`.**
- `src/server/repositories/user.repository.ts` exporta `findByClerkId`,
  `findById`, `assignRole(tx, …)`, `revokeRole(tx, …)`. No hay upsert.
- `src/lib/audit.ts` exporta `logAudit(tx, entry)` y `stripSensitive`. **Sin
  ningún consumidor todavía**: este spec es el primero.
- `src/lib/permissions.ts` exporta `resolvePermissions`, `can`,
  `DEFAULT_ROLE_SLUG = "customer"`; `permission.repository.listCodesByClerkId`
  resuelve los permisos efectivos en un solo join.
- `@clerk/nextjs@7.8.2` expone el subpath `./webhooks` con
  `verifyWebhook(request, options?) => Promise<WebhookEvent>`
  (`node_modules/@clerk/nextjs/dist/types/webhooks.d.ts`), que lee
  `CLERK_WEBHOOK_SIGNING_SECRET` del entorno.
- **No hace falta instalar `svix`**: `@clerk/backend@3.16.12` depende de
  `standardwebhooks` y su `verifyWebhook` mapea los headers `svix-id` /
  `svix-timestamp` / `svix-signature` a los de Standard Webhooks
  (`node_modules/@clerk/backend/dist/webhooks.js:40-71`). **Cero dependencias
  nuevas en este spec.**

Cierra además el hallazgo de review del spec 001 (webhook sin verificación de
firma) y la deuda MENOR-1 del review 004 (`SENSITIVE_KEY` incompleto), que se
salda acá por ser el primer consumidor real de `logAudit`.

Depende de la fase 1. Bloquea la fase 4 (comparte `upsertUserFromClerk` y
`syncClerkPublicMetadata`).

## 2. Objetivo

Toda alta, cambio o baja de usuario en Clerk se refleja en `users` en el request
siguiente, todo usuario que se registra en el storefront queda con rol
`customer`, y `publicMetadata` de Clerk lleva el resumen derivado
`{ roles, panel }` que la fase 3 consultará desde el borde.

## 3. Alcance

### Incluye

- `POST /api/webhooks/clerk` con `verifyWebhook(req)` **antes** de tocar datos.
  Eventos `user.created`, `user.updated`, `user.deleted`.
- `src/lib/clerk-sync.ts` — `upsertUserFromClerk`, `deactivateUserFromClerk`,
  `syncClerkPublicMetadata`. Los tres los reutiliza la fase 4.
- `user.repository.ts` — `upsertByClerkId(tx, …)`, `deactivateByClerkId(tx, …)`,
  `revokeAllRoles(tx, …)`.
- `role.repository.ts` — `listSlugsByUserId(userId)`.
- `CLERK_WEBHOOK_SIGNING_SECRET` en `.env.local` y `.env.example`.
- Script de backfill (`npm run sync:clerk-users`) que importa los usuarios que ya
  existen en Clerk.
- **Deuda MENOR-1 del review 004**: ampliar la redacción de `src/lib/audit.ts` y
  el self-check `src/lib/rbac.check.ts`.
- Documentar (no automatizar) la configuración manual del endpoint en el
  dashboard de Clerk.

### No incluye (explícito)

- Cambios en `src/proxy.ts` y el chequeo optimista del borde (fase 3).
- `requirePermission()` en los 10 handlers de admin (fase 3).
- Cualquier UI y los endpoints `/api/admin/users/**` (fase 4).
- Personalización del token de sesión en el dashboard de Clerk
  (`{{user.public_metadata}}` → `sessionClaims.metadata`): es **paso manual de la
  fase 3**, se documenta acá pero no es tarea de este spec.
- Migración de esquema: **ninguna**. No hay tabla de deduplicación de webhooks
  (ver §8).
- Eventos de Clerk distintos de `user.*` (`session.*`, `organization*`,
  `email.created`): se responden `200` y se ignoran.
- Auditar `user.updated`: no es una mutación de seguridad.

## 4. Criterios de aceptación

- [x] AC1 — Dado un `POST /api/webhooks/clerk` con firma inválida o sin headers
      `svix-*`, entonces responde `400` y **no** se escribe ni una fila en
      `users`, `user_roles` ni `audit_logs`.
- [ ] AC2 — Dado un registro nuevo en el storefront, cuando llega `user.created`,
      entonces existe la fila en `users` (email, nombre e imagen del payload),
      una fila en `user_roles` con el rol `customer`, y una fila en `audit_logs`
      con `action = "user.created"`, `actor_id = NULL` y
      `metadata.svixId = <header svix-id>`.
- [ ] AC3 — Dado el mismo `user.created` reenviado por Svix (mismo `svix-id`),
      entonces responde `200`, no duplica la fila de `users`, ni la de
      `user_roles`, **ni agrega una segunda fila en `audit_logs`**.
- [ ] AC4 — Dado un usuario que la fase 4 ya insertó con rol `manager`, cuando
      llega su `user.created`, entonces se actualizan sus datos y **conserva
      `manager`**: no se le agrega `customer`.
- [ ] AC5 — Dado `user.updated` con nombre e imagen nuevos, entonces la fila de
      `users` queda actualizada, `user_roles` no cambia y no se escribe en
      `audit_logs`.
- [ ] AC6 — Dado `user.deleted`, entonces la fila queda `is_active = false`, sus
      filas de `user_roles` se borran y queda una fila en `audit_logs` con
      `action = "user.deleted"` y `severity = "warning"`. Un segundo
      `user.deleted` responde `200` sin escribir una segunda fila de auditoría.
- [ ] AC7 — Dado un usuario con `dashboard.read` efectivo, cuando corre
      `syncClerkPublicMetadata(clerkId)`, entonces su `publicMetadata` en Clerk
      queda `{ roles: [...], panel: true }`; para un `customer`, `panel: false`.
- [ ] AC8 — Dado que `syncClerkPublicMetadata` dispara a su vez un `user.updated`
      de Clerk, entonces ese evento **no** vuelve a llamar a
      `syncClerkPublicMetadata` (sin bucle infinito, ver §8).
- [x] AC9 — Dado `npm run sync:clerk-users` con usuarios preexistentes en Clerk,
      entonces todos quedan en `users` con rol `customer` (salvo los que ya
      tengan rol) y con su `publicMetadata` escrito; una segunda corrida no
      duplica nada y reporta 0 nuevos.
- [ ] AC10 — Dado un evento `user.created` sin ninguna dirección de email,
      entonces responde `200`, registra el aviso y no inserta nada (no hay dato
      para la columna `email`, que es `NOT NULL`).
- [x] AC11 — Dado `stripSensitive({ after: { shippingAddress, pin, cvv, ssn,
      jwt, sessionId, cookie, bearerToken, privateKey } })`, entonces
      `shippingAddress` **queda intacto** y los otros ocho salen `"[REDACTED]"`.
- [ ] AC12 — `npm run check:rbac` en verde y
      `npm run typecheck && npm run lint && npm run build` en verde.

## 5. Modelo de datos

**Sin cambios de esquema. Sin migración.** Se usan tal cual las tablas de la
fase 1: `users`, `user_roles`, `roles`, `audit_logs`.

Columnas que escribe este spec:

| Tabla | Columnas | Origen |
|---|---|---|
| `users` | `clerk_id`, `email`, `first_name`, `last_name`, `image_url`, `is_active` | payload `UserJSON` de Clerk |
| `user_roles` | `user_id`, `role_id` (`customer`), `assigned_by = NULL` | default del servidor |
| `audit_logs` | `actor_id = NULL`, `action`, `entity_type = "user"`, `entity_id`, `metadata`, `severity` | webhook |

`actor_id = NULL` es el caso "sistema/webhook" ya previsto por `AuditEntry`
(004 §6). `metadata` lleva `{ clerkId, svixId, source: "clerk-webhook" }`.

Mapeo del payload (tipos verificados en
`node_modules/@clerk/backend/dist/api/resources/JSON.d.ts:589-605`):

```
email      ← email_addresses.find(e => e.id === primary_email_address_id)?.email_address
             ?? email_addresses[0]?.email_address     // sin ninguno → AC10
firstName  ← first_name   (string | null)
lastName   ← last_name    (string | null)
imageUrl   ← image_url    (string)
```

`user.deleted` trae `UserDeletedJSON` (`JSON.d.ts:656-672`), donde **`id` es
opcional**: hay que guardarlo antes de usarlo.

## 6. Contratos de API

| Método | Ruta | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/webhooks/clerk` | firma Svix (`verifyWebhook`); ruta pública en `proxy.ts` | `WebhookEvent` de Clerk (JSON crudo) | `200 { ok: true }` · `400 { error }` si la firma falla |

**Sin schema Zod, con justificación.** La regla dura 4 de `CLAUDE.md` pide
validar la entrada antes de tocar datos; acá esa validación es
`verifyWebhook(req)`, que es **más fuerte** que Zod: verifica criptográficamente
que el cuerpo lo firmó Clerk y devuelve una unión discriminada tipada
(`WebhookEvent`) que `tsc` obliga a estrechar por `evt.type`. Un schema Zod
encima duplicaría los tipos de Clerk sin agregar garantía. Las dos únicas
comprobaciones puntuales que sí se escriben a mano son el email primario (AC10) y
el `id` opcional de `user.deleted`.

El handler **siempre responde `200`** salvo fallo de firma, incluso ante datos
inservibles: un `4xx`/`5xx` hace que Svix reintente en bucle un evento que ningún
reintento va a arreglar. Los errores inesperados de BD sí devuelven `500`, porque
esos sí conviene reintentarlos.

### Funciones nuevas (contrato de servidor)

| Función | Archivo | Firma |
|---|---|---|
| `upsertUserFromClerk` | `lib/clerk-sync.ts` | `(input: ClerkUserInput, ctx: { svixId?: string \| null }) => Promise<{ user: User; created: boolean; assignedDefaultRole: boolean }>` |
| `deactivateUserFromClerk` | `lib/clerk-sync.ts` | `(clerkId: string, ctx: { svixId?: string \| null }) => Promise<boolean>` (`false` = ya estaba inactivo) |
| `syncClerkPublicMetadata` | `lib/clerk-sync.ts` | `(clerkId: string) => Promise<void>` |
| `upsertByClerkId` | `repositories/user.repository.ts` | `(tx: Tx, values: ClerkUserInput) => Promise<{ user: User; created: boolean; reclaimedFrom?: string }>` (`reclaimedFrom` = `clerk_id` viejo cuando la fila se re-apuntó por choque de email, ver §8) |
| `deactivateByClerkId` | `repositories/user.repository.ts` | `(tx: Tx, clerkId: string) => Promise<User \| undefined>` |
| `revokeAllRoles` | `repositories/user.repository.ts` | `(tx: Tx, userId: string) => Promise<void>` |
| `listSlugsByUserId` | `repositories/role.repository.ts` | `(userId: string) => Promise<string[]>` |

```ts
export type ClerkUserInput = {
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

// publicMetadata que escribe syncClerkPublicMetadata. Lo lee el borde en la fase 3.
type PanelMetadata = { roles: string[]; panel: boolean };
```

`panel` se deriva de `permissionRepository.listCodesByClerkId(clerkId)
.includes("dashboard.read")`, no de una lista de roles hardcodeada: si mañana la
matriz cambia, el resumen sigue siendo correcto. La escritura usa
`(await clerkClient()).users.updateUserMetadata(clerkId, { publicMetadata })`
(`updateUser` para metadata está deprecado en `@clerk/backend@3.16.12`,
`UserApi.d.ts:286-294`; `clerkClient()` es asíncrono en v7).

## 7. Arquitectura y archivos afectados

| Capa | Archivo | Estado | Qué hace |
|---|---|---|---|
| Lib | `src/lib/audit.ts` | modificado | redacción ampliada (MENOR-1) |
| Check | `src/lib/rbac.check.ts` | modificado | casos nuevos de redacción |
| Repo | `src/server/repositories/user.repository.ts` | modificado | `upsertByClerkId`, `deactivateByClerkId`, `revokeAllRoles` |
| Repo | `src/server/repositories/role.repository.ts` | modificado | `listSlugsByUserId` |
| Lib | `src/lib/clerk-sync.ts` | nuevo | orquestación transaccional + metadata |
| API | `src/app/api/webhooks/clerk/route.ts` | nuevo | `POST`, verifica firma y despacha por `evt.type` |
| Script | `src/server/db/backfill-clerk-users.ts` | nuevo | importa los usuarios existentes en Clerk |
| Config | `package.json` | modificado | script `sync:clerk-users` |
| Config | `.env.example` / `.env.local` | modificado | `CLERK_WEBHOOK_SIGNING_SECRET` |

Sin componentes shadcn: este spec no toca UI.

### Reutilizar (verificado con Read/Grep — usar tal cual, no reescribir)

- `src/lib/audit.ts` — `logAudit(tx, entry)` con `tx` **obligatorio**. Las dos
  auditorías de este spec van dentro de la misma `db.transaction()` que la
  mutación. No se llama nunca fuera de una transacción.
- `src/server/repositories/user.repository.ts` — `assignRole(tx, { userId,
  roleId, assignedBy })` ya hace `onConflictDoNothing()`: la asignación de
  `customer` es idempotente sin código extra. `findByClerkId` se usa tal cual en
  `syncClerkPublicMetadata`.
- `src/server/repositories/role.repository.ts` — `findBySlug("customer")` ya
  existe; no se hardcodea el UUID del rol.
- `src/server/repositories/permission.repository.ts` — `listCodesByClerkId`
  (join único, filtra `is_active`) para derivar `panel`.
- `src/lib/db-errors.ts` — `isUniqueViolation(error)` +
  `violatedConstraint(error)` para distinguir el choque contra
  `users_email_unique`. **No se parsea el error de Postgres a mano.**
- `src/server/db/index.ts` — `db.transaction()` (habilitado por el cambio de
  driver de la fase 1) y `export type Tx`.
- `src/server/db/seed.ts` — patrón del script `tsx`: `config({ path: ".env.local" })`
  **antes** de importar `db` (import dinámico, porque `db` lee `DATABASE_URL` al
  evaluarse) y `.catch(err => { console.error(err); process.exit(1) })` al pie.
  El backfill lo copia; **`seed.ts` no se toca.**
- `src/lib/rbac.check.ts` — patrón de self-check con `assert` + `tsx`. Se le
  agregan casos, no se crea un archivo nuevo ni se instala un runner.
- `src/proxy.ts` — `/api/webhooks(.*)` ya es público (línea 9). **No se toca.**

### Configuración manual en el dashboard de Clerk (no es código)

1. **Webhooks → Add endpoint**: `https://<dominio>/api/webhooks/clerk`,
   suscrito a `user.created`, `user.updated`, `user.deleted`. Copiar el signing
   secret a `CLERK_WEBHOOK_SIGNING_SECRET`.
2. **Local**: `clerk webhooks listen --token "$(clerk webhooks token)"
   --forward-to http://localhost:3000/api/webhooks/clerk` y dar de alta la URL de
   relay que imprime como endpoint en el dashboard (sin eso no fluyen eventos).
3. **Fase 3, no ahora**: Sessions → Customize session token con
   `{"metadata": "{{user.public_metadata}}"}` para que el borde lea
   `sessionClaims.metadata.panel`. Este spec solo **escribe** el metadata.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| **Sin tabla de deduplicación de webhooks**; `svix-id` se guarda en `audit_logs.metadata` | Tabla `webhook_events` con PK `svix_id` + migración | Las tres operaciones son idempotentes por construcción (upsert, `onConflictDoNothing`, desactivación condicional) y la auditoría solo se emite cuando el estado cambió de verdad. Una tabla nueva más su purga es infraestructura para un problema que el diseño ya resuelve. El `svix-id` queda igual en la traza para poder correlacionar un reintento. **Techo**: si aparece un evento no idempotente (un email de bienvenida), ahí sí entra la tabla |
| `user.created` y `user.updated` comparten rama | Dos bloques con el mismo upsert | El payload es el mismo tipo (`Webhook<'user.created' \| 'user.updated', UserJSON>`); lo único que difiere es que la auditoría se emite solo si la fila se creó. Además hace la sincronización auto-reparable: si se perdió un `user.created`, el primer `user.updated` recupera la fila |
| `created` se deduce de `insert().onConflictDoNothing({ target: users.clerkId }).returning()`: si vuelve fila, se creó; si no, `update()` | `onConflictDoUpdate` + comparar `created_at` con `updated_at` | Una sola sentencia en el camino de alta y cero heurísticas de timestamps. Es también lo que hace idempotente a la auditoría (AC3) |
| Choque contra `users_email_unique` → se re-apunta esa fila al `clerk_id` nuevo y se reactiva | Dejar que explote (500) | Escenario real: borrar la cuenta en Clerk y volver a registrarse con el mismo email genera un `clerk_id` nuevo sobre un email que ya existe. Sin esta rama, Svix reintenta un `500` en bucle y la persona nunca queda en `users`. Se audita como `user.created` con `metadata.reclaimedFrom` |
| `syncClerkPublicMetadata` se llama **solo** si `created \|\| assignedDefaultRole` (y fuera de la transacción) | Llamarlo en todo `user.updated` | Escribir `publicMetadata` dispara un `user.updated` de Clerk: llamarlo siempre es un **bucle infinito de webhooks**. Con la condición, el evento de rebote encuentra `created = false` y roles ya asignados, y corta (AC8). Fuera de la transacción porque una llamada de red no debe mantener abierta una conexión de Postgres, y porque el metadata es un cache derivado: si Clerk falla, se registra el error y la BD —que es la fuente de verdad— ya quedó bien |
| `panel` derivado de `listCodesByClerkId(...).includes("dashboard.read")` | Lista de roles con panel hardcodeada en el helper | Un solo lugar define quién ve el panel: la matriz. `clerk-sync.ts` no importa `@/lib/permissions` en runtime (arrastra `next/server`), solo el tipo |
| `roles: []` cuando el usuario no tiene filas en `user_roles`, sin rellenar `"customer"` | Rellenar con `DEFAULT_ROLE_SLUG` | El default vive en un solo lugar (`resolvePermissions`, SETUP.md §5.1 regla 3). En el flujo real nunca queda vacío: el webhook asigna `customer` antes de sincronizar. `panel` —que es lo que decide el borde— es correcto igual |
| El handler responde `200` ante payloads inservibles y `500` solo ante errores de BD | `400`/`422` para todo lo malo | Svix reintenta con `4xx` y `5xx`. Un evento sin email no mejora con reintentos; una caída de Neon sí |
| Script `sync:clerk-users` aparte de `db:seed` | Extender `db:seed` | `db:seed` hoy no necesita `CLERK_SECRET_KEY` ni red hacia Clerk; mezclarlo obliga a tener credenciales de Clerk para sembrar la base. Son dos operaciones con prerrequisitos distintos |
| El backfill sincroniza `publicMetadata` de **todos** los usuarios que procesa | Solo los que tienen panel | Es una línea dentro del loop, y garantiza que el `super_admin` sembrado en la fase 1 tenga su `panel: true` antes de que la fase 3 encienda el borde (si no, el dueño se queda afuera de su propio panel). **Techo**: son N llamadas a Clerk (límite dev: 100 req/10 s). Se marca con un comentario `ponytail:` y se pagina si el equipo crece |
| Ampliar `SENSITIVE_KEY` por **segmentos** para `pin`/`cvv`/`ssn`/`jwt` y por subcadena para el resto | Una sola regex de subcadenas con todos los términos | `/pin/i` sobre `shippingAddress` da un falso positivo (`shi-PIN-g`) y redactaría la dirección de envío de un pedido. Los términos cortos se comparan contra los segmentos del nombre de la clave (`pinCode` → `["pin","code"]`) |

## 9. Tareas

- [x] **T1** — Ampliar la redacción: `SENSITIVE_KEY` suma `private[-_]?key`, `cookie`, `bearer`, `session`, `credential`; y una comprobación por segmentos (`key.replace(/([a-z])([A-Z])/g,"$1_$2").toLowerCase().split(/[^a-z0-9]+/)`) para `pin`, `cvv`, `ssn`, `jwt`. Sin tocar la firma de `stripSensitive` · archivo: `src/lib/audit.ts` · verificación: `npm run typecheck`
- [x] **T2** — Casos nuevos del self-check: los ocho términos de MENOR-1 salen `[REDACTED]` y `shippingAddress` queda intacto (AC11) · archivo: `src/lib/rbac.check.ts` · verificación: `npm run check:rbac`
- [x] **T3** — `upsertByClerkId(tx, values)` devolviendo `{ user, created }`: `insert().onConflictDoNothing({ target: users.clerkId }).returning()` y, si no vuelve fila, `update().where(eq(users.clerkId, …)).returning()`. Rama de rescate: si el insert lanza `isUniqueViolation` con `violatedConstraint === "users_email_unique"`, re-apunta la fila de ese email al `clerk_id` nuevo con `is_active = true` · archivo: `src/server/repositories/user.repository.ts` · verificación: `npm run typecheck`
- [x] **T4** — `deactivateByClerkId(tx, clerkId)`: `update` con `where(and(eq(clerkId), eq(isActive, true)))` y `.returning()` (vacío = ya estaba inactiva), y `revokeAllRoles(tx, userId)` · archivo: `src/server/repositories/user.repository.ts` · verificación: `npm run typecheck`
- [x] **T5** — `listSlugsByUserId(userId)`: `user_roles innerJoin roles`, devuelve los slugs ordenados · archivo: `src/server/repositories/role.repository.ts` · verificación: `npm run typecheck`
- [x] **T6** — `syncClerkPublicMetadata(clerkId)`: resuelve `findByClerkId` → `listSlugsByUserId` → `listCodesByClerkId`, y escribe `{ roles, panel }` con `(await clerkClient()).users.updateUserMetadata(...)` · archivo: `src/lib/clerk-sync.ts` · verificación: `npm run typecheck`
- [x] **T7** — `upsertUserFromClerk(input, { svixId })`: una `db.transaction()` con upsert + asignación de `customer` si `listSlugsByUserId` viene vacío (resolviendo el rol con `roleRepository.findBySlug`) + `logAudit` solo si `created`. Devuelve `{ user, created, assignedDefaultRole }` · archivo: `src/lib/clerk-sync.ts` · verificación: `npm run typecheck`
- [x] **T8** — `deactivateUserFromClerk(clerkId, { svixId })`: una `db.transaction()` con `deactivateByClerkId` + `revokeAllRoles` + `logAudit({ action: "user.deleted", severity: "warning" })`; si la fila ya estaba inactiva devuelve `false` sin auditar · archivo: `src/lib/clerk-sync.ts` · verificación: `npm run typecheck`
- [x] **T9** — Route Handler `POST`: `verifyWebhook(req)` en `try/catch` → `400`; luego `svix-id` del header, rama compartida `user.created`/`user.updated` (con el email primario y el aviso de AC10), rama `user.deleted` (con guarda del `id` opcional), `default` → `200` ignorado; `syncClerkPublicMetadata` solo si `created || assignedDefaultRole`, envuelto en su propio `try/catch` que loguea sin romper la respuesta · archivo: `src/app/api/webhooks/clerk/route.ts` · verificación: `npm run typecheck && npm run lint`
- [ ] **T10** — Documentar `CLERK_WEBHOOK_SIGNING_SECRET` (de dónde sale, formato `whsec_...`) y cargarla en `.env.local` · archivos: `.env.example`, `.env.local` · verificación: revisión visual
      > Documentada en `.env.example` (origen, formato y el comando de `clerk webhooks listen`) y declarada vacía en `.env.local`. **Falta el valor real**: sale del dashboard de Clerk y lo tiene que pegar el usuario. Hasta entonces `verifyWebhook` rechaza todo con `400`.
- [x] **T11** — Script de backfill: pagina `getUserList({ limit: 100, offset })` hasta `totalCount`, y por cada usuario llama `upsertUserFromClerk` + `syncClerkPublicMetadata`; reporta creados / actualizados / omitidos sin email · archivo: `src/server/db/backfill-clerk-users.ts` + script `sync:clerk-users` en `package.json` · verificación: `npm run sync:clerk-users` dos veces seguidas (AC9)
      > Corrido dos veces contra Neon y Clerk reales: `1 creados, 0 actualizados` y después `0 creados, 1 actualizados`. AC9 en verde. La fila quedó con rol `customer` y `publicMetadata { roles: ["customer"], panel: false }`.
- [ ] **T12** — Alta del endpoint en el dashboard de Clerk + `clerk webhooks listen` apuntando a `/api/webhooks/clerk`; probar el `400` de firma inválida con un `curl` sin headers `svix-*` (AC1) · verificación: AC1 y el evento llegando al handler
      > **AC1 verificado localmente**: `curl` sin headers `svix-*` y con `svix-signature: v1,bogus` devuelven los dos `400 {"error":"Firma inválida"}`, antes de tocar la base. **Falta la parte del usuario**: dar de alta el endpoint en el dashboard y correr `clerk webhooks listen` para que fluyan eventos reales.
- [ ] **T13** — Recorrido end-to-end con `npm run dev`: registrarse en el storefront (AC2), editar el perfil en Clerk (AC5), reenviar el evento desde el dashboard (AC3), borrar la cuenta en Clerk (AC6) y verificar `users` / `user_roles` / `audit_logs` en `db:studio` · verificación: los cuatro ACs y `npm run typecheck && npm run lint && npm run build`
- [ ] **T14** — **PAUSA: validación humana.** Confirmar en el dashboard de Clerk que el `publicMetadata` del super admin quedó `{ roles: ["super_admin"], panel: true }` y el de un cliente `panel: false`. Sin esto no arranca la fase 3, que depende de ese claim
      > **Bloqueado por una deuda de la fase 1, no por este spec**: `.env.local` no tiene `SUPER_ADMIN_CLERK_ID` ni `SUPER_ADMIN_EMAIL`, así que `db:seed` nunca promovió al super admin y `users` estaba vacía. El backfill hizo lo correcto con lo que había: el único usuario de Clerk no tenía ningún rol y quedó como `customer`, `panel: false`. Para cerrar T14: cargar las dos variables, `npm run db:seed`, `npm run sync:clerk-users`.

## 10. Riesgos y consideraciones

- **Bucle de webhooks.** Es el riesgo número uno: escribir `publicMetadata`
  genera un `user.updated`. La condición `created || assignedDefaultRole` corta el
  rebote en el primer salto. Si el developer la relaja, cada usuario entra en un
  ciclo infinito de eventos que además consume rate limit de Clerk. Verificar en
  el log de Svix que un alta genera exactamente 2 eventos, no N.
- **Los webhooks son eventualmente consistentes.** La fase 4 no puede depender de
  ellos para mostrar a la persona recién creada: la crea en `users` dentro de su
  propia transacción. Por eso el upsert de acá está diseñado para *no pisar* un
  rol ya asignado (AC4).
- **Orden de eventos.** Si `user.updated` llega antes que `user.created` (o el
  `created` se perdió), la rama compartida crea la fila igual. El único orden que
  no se recupera solo es `user.deleted` seguido de un `user.created` viejo
  reintentado: reactivaría a alguien borrado. Es una ventana estrecha y Svix
  entrega en orden por endpoint; se acepta.
- **Lecturas con `db` dentro de una transacción abierta con `tx`.**
  `listSlugsByUserId` y `findBySlug` usan `db` (otra conexión del pool) mientras
  la transacción tiene el `INSERT` sin commitear. Es correcto acá porque solo
  leen `roles`/`user_roles`, que la transacción todavía no tocó; y una carrera
  con la fase 4 la absorbe el `onConflictDoNothing` de `assignRole`.
- **`users.email` es `UNIQUE` y `NOT NULL`.** Dos identidades de Clerk con el
  mismo email (un alta social y otra con contraseña) chocan; la rama de rescate
  las funde en una sola fila local, que es el comportamiento deseado, pero deja
  el `clerk_id` viejo huérfano. Queda en la traza vía `metadata.reclaimedFrom`.
- **`user.deleted` borra `user_roles` pero conserva la fila de `users`**, porque
  `audit_logs.actor_id` la referencia con `ON DELETE SET NULL` y borrarla haría
  perder la identidad del actor en trazas viejas. La baja es lógica, no física.
- **`stripSensitive` sigue siendo heurístico** por nombre de clave. Ampliarlo
  reduce falsos negativos pero no reemplaza la regla: el llamador nunca mete
  secretos en `changes`. Relevante en la fase 4, con la contraseña temporal.
- **Rate limit de Clerk**: 100 req/10 s en instancias de desarrollo. El backfill
  hace 2 llamadas por usuario (listado paginado + `updateUserMetadata`). Con
  decenas de usuarios no molesta; con cientos hay que espaciar.
- **Rollback**: borrar `src/app/api/webhooks/clerk/`, `src/lib/clerk-sync.ts`, el
  script de backfill y sus adiciones en los repositorios; quitar el endpoint en
  el dashboard de Clerk. Los datos ya sincronizados en `users` quedan y no
  molestan. La ampliación de `SENSITIVE_KEY` no se revierte.

## 11. Fuera de alcance / deuda aceptada

- **Sin deduplicación persistente por `svix-id`** (§8). Si más adelante el
  webhook dispara efectos no idempotentes, hace falta la tabla.
- **`user.updated` no se audita.** No es una mutación de seguridad; auditar cada
  cambio de avatar llenaría `audit_logs` de ruido.
- **Sin reconciliación periódica Clerk → Postgres.** Si un webhook se pierde
  definitivamente, la corrección es correr `npm run sync:clerk-users` a mano. Un
  cron de conciliación se agrega cuando haya evidencia de pérdidas.
- **El borde sigue sin leer `publicMetadata`**: este spec lo escribe, la fase 3 lo
  consume. Hasta entonces el claim existe pero nadie lo mira, y la
  personalización del token de sesión sigue sin hacerse en el dashboard.
- **`getCurrentUser()` sigue devolviendo `user: null`** para cualquier `clerk_id`
  que todavía no haya pasado por el webhook ni por el backfill.
- **Usuario desactivado cae al fallback `customer`** (review 004, MENOR-2): sigue
  abierto. Ahora importa un poco más, porque `user.deleted` empieza a producir
  usuarios con `is_active = false`. Hoy `customer` tiene 0 permisos, así que
  equivale a denegado; se cierra cuando `customer` gane algún permiso.
- **`create()` que miente en su tipo de retorno** (review 002, MENOR-6): las
  funciones nuevas de repositorio siguen el mismo patrón
  `const [row] = await ...returning()`. Se corrige en bloque al encender
  `noUncheckedIndexedAccess`.
- **Sin tests automatizados del handler**: la verificación es el recorrido manual
  de T13 más el self-check de redacción. El proyecto no tiene runner de tests y
  este spec no lo introduce.
