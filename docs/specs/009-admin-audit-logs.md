---
id: 009
title: Bitácora de auditoría
status: in-review
module: auth
scope: admin
---

# 009 — Bitácora de auditoría

## Contexto
Fase 6 (última) de la hoja de ruta RBAC. Con 006/007/008 `done`, la tabla
`audit_logs` ya recibe 6 tipos de evento (`user.created`, `user.deleted`,
`role.assigned`, `role.revoked`, `role.permission_granted`,
`role.permission_revoked`) y nadie puede leerlos salvo en `db:studio`. Falta el
visor. `audit_logs` es append-only (SETUP §5.2 regla 1): este spec **no agrega
ninguna forma de mutarla**.

## Objetivo
Quien tenga `audit_logs.read` (`super_admin`, `admin`, `audit`) abre
`/admin/audit-logs`, filtra la traza y entiende cada fila en lenguaje claro, sin
ver un solo código crudo ni un JSON.

## Alcance
Incluye: `GET /api/admin/audit-logs` paginado por cursor con filtros;
`audit-log.repository.ts` de solo lectura; módulo `src/modules/audit/**`; página
con guard propio; item "Auditoría" en el nav.
No incluye: auditar mutaciones `product.*`/`category.*` (deuda 004 §11);
job de purga por retención (SETUP §5.2 regla 5); exportar a CSV/PDF; alertas;
cualquier `INSERT`/`UPDATE`/`DELETE` sobre `audit_logs`; endpoint de facets
(decisión 2); Fase 0 (migrate/seed/sync/webhook) — prerrequisito humano.

> AC1–AC10 quedan **pendientes de Fase 0**: sin datos sembrados no hay sesión ni
> filas que mirar. No se marcan sin ejecutarlos (T11).

## Criterios de aceptación
- [ ] AC1 — Dado un usuario con puesto Auditoría, cuando abre `/admin/audit-logs`, entonces ve las 50 filas más recientes ordenadas de la más nueva a la más vieja, con fecha local, actor, acción en español y badge de severidad.
- [ ] AC2 — Dado el filtro Severidad en "Advertencia", cuando se aplica, entonces solo quedan las bajas (`user.deleted`) y los cambios de permisos de puesto (`role.permission_*`), y ninguna `role.assigned` (que es `info`).
- [ ] AC3 — Dado el filtro Actor apuntando al Dueño, cuando se aplica, entonces todas las filas tienen `actor_id` del Dueño; y eligiendo "Sistema" quedan solo las de `actor_id IS NULL` (webhook de Clerk).
- [ ] AC4 — Dado el rango Desde 2026-01-01 / Hasta 2026-01-31, cuando se aplica, entonces se incluyen los eventos del 31 de enero completo (límite superior inclusivo) y ninguno de febrero.
- [ ] AC5 — Dado que hay 120 filas y se pulsa "Cargar más" dos veces, entonces se ven 150 filas, sin ninguna repetida y sin ningún salto respecto del orden `created_at desc, id desc`, y el botón desaparece cuando `nextCursor` es `null`.
- [ ] AC6 — Dada una fila escrita por el webhook (`actor_id` null), cuando se lista, entonces la columna Actor muestra "Sistema", no un guion ni un uuid.
- [ ] AC7 — Dada una fila `role.permission_revoked`, cuando se expande, entonces se lee "Se quitó el permiso «Eliminar productos» del puesto «Encargado»" — descripción del permiso y nombre del puesto, nunca `products.delete` ni `manager`.
- [ ] AC8 — Dada una fila con una `action` que no está en el mapa de etiquetas, cuando se lista, entonces se muestra la cadena cruda y la tabla no rompe.
- [ ] AC9 — Dado un `manager` (sin `audit_logs.read`), cuando entra al panel, entonces el nav no muestra "Auditoría"; si escribe `/admin/audit-logs` termina en `/sin-acceso`; y `GET /api/admin/audit-logs` le responde `403`.
- [ ] AC10 — Dado un `POST`/`PATCH`/`DELETE` a `/api/admin/audit-logs`, entonces la respuesta es `405` (el archivo no exporta esos métodos) y no se escribe ninguna fila.
- [ ] AC11 — Dado `?limit=500` o `?severity=critica` o un `cursor` mal formado, entonces la respuesta es `400 {"error":"Parámetros inválidos", issues:[…]}`.

## Datos
**Sin cambios de esquema. Sin migración. Sin índices nuevos.**
La consulta es `WHERE <filtros> AND (created_at, id) < (cursor) ORDER BY
created_at DESC, id DESC LIMIT n+1`. `audit_logs_created_at_idx (created_at desc)`
da el orden y acota el rango; el desempate por `id` y los filtros por `action` /
`severity` se resuelven arriba del index scan. A la escala de un panel de
administración (decenas de eventos por semana) alcanza; ver deuda si crece.

## API
| Método | Ruta | Permiso | Query | Response |
|---|---|---|---|---|
| GET | `/api/admin/audit-logs` | `audit_logs.read` | `listAuditLogsQuerySchema` | `200 AuditLogsPage` · `400` · `403` · `500` |

`AuditLogsPage = { items: AuditLogRow[]; nextCursor: string | null }`
`AuditLogRow = Omit<AuditLog, "ipAddress" | "userAgent"> & { actor: { id, email, firstName, lastName } | null }`

Zod en `src/modules/audit/schemas/audit-log.schema.ts` (importa el enum de
severidad de `@/server/db/schema` vía `import type`, o lo declara con
`z.enum(["info","warning","error"])` — es el mismo dato y no arrastra la BD al
bundle; **no** importar de `@/lib/permissions`):
- `action?` — `z.string().trim().max(64)`, **libre**, no enum (decisión 2).
- `entityType?` — igual, `max(32)`.
- `actorId?` — `z.union([z.literal("system"), z.uuid()])`.
- `severity?` — `z.enum(["info","warning","error"])`.
- `from?`, `to?` — `z.iso.date()` (`YYYY-MM-DD`, exactamente lo que emite `<input type="date">`).
- `limit?` — `z.coerce.number().int().min(1).max(100).default(50)`.
- `cursor?` — `z.string()` refinado sobre el formato de abajo.

**Formato del cursor:** `"<createdAt ISO 8601>|<uuid de la fila>"`, tomado de la
última fila devuelta. Texto plano, no base64: es opaco igual para el cliente y
ahorra el ida y vuelta de codificación. El schema lo parte por `|`, valida
`z.iso.datetime()` + `z.uuid()` y lo transforma en `{ createdAt: Date, id }`;
cualquier otra cosa es `400`.

## Reutilizar
- `src/lib/permissions.ts` — `requirePermission("audit_logs.read")`, `can`. Tal cual.
- `src/lib/auth.ts` — `requirePanelAccess()` en la page (memoizado por request).
- `src/lib/rbac-catalog.ts` — `PERMISSIONS` (tiene `description` en español: "Eliminar productos") y `ROLES` (tiene `name`: "Encargado"). Es lo que traduce el contenido de `changes`/`metadata` en la fila expandida. Dato puro, client-safe.
- `src/modules/users/hooks/use-users.ts` — `useUsers()` **tal cual** para poblar el `<Select>` de actor: los 3 puestos con `audit_logs.read` tienen también `users.read` (verificado en `rbac-catalog.ts`). Cero código nuevo, cero endpoint de facets.
- `src/components/ui/{table,badge,button,select,input,skeleton}.tsx` — instalados. Rango de fechas con `<input type="date">` nativo. **No hay que instalar nada.**
- Patrones a copiar: `src/app/api/admin/users/route.ts` (`GET` con `safeParse(Object.fromEntries(request.nextUrl.searchParams))`, `console.error` + 500); `src/server/repositories/user.repository.ts:list` (`SQL[]` de condiciones + `leftJoin` + agrupado); `src/modules/users/{services,hooks,types}` (BASE_URL, key + invalidación, `export type` del schema Drizzle); `src/app/(admin)/admin/users/page.tsx` (guard propio); `src/modules/roles/lib/permission-groups.ts` (forma del mapa de etiquetas con fallback).

## Decisiones técnicas
1. **Cursor, no offset.** La tabla solo crece y el `OFFSET` grande degrada y
   duplica filas cuando entran eventos nuevos entre página y página (AC5). El
   keyset `(created_at, id) < (…)` usa comparación de filas de Postgres, una
   línea de `sql`, y es estable ante inserciones concurrentes. El `id` es el
   desempate: dos eventos de la misma transacción comparten `created_at`.
2. **Sin endpoint de facets.** Las `action` posibles nacen en el código, no en
   los datos: son las 6 que escriben 005/007/008. Se derivan del mapa fijo de
   etiquetas y el filtro de actor sale de `useUsers()`. Un `SELECT DISTINCT` por
   render sería una query extra para una lista que ya conocemos. Aun así, el
   filtro `action` viaja como **string libre**, no como enum: cuando se auditen
   `product.*` (deuda 004 §11) el endpoint sigue sirviendo sin tocar el schema, y
   una `action` desconocida se muestra cruda (AC8) en vez de romper.
3. **`useInfiniteQuery`.** Es el par natural del cursor: `getNextPageParam:
   (last) => last.nextCursor`, `initialPageParam: null`, y "Cargar más" es
   `fetchNextPage()`. Con `useQuery` habría que acumular páginas a mano en un
   `useState` y volver a resolver el problema que la librería ya resuelve. La key
   incluye los filtros (`[...auditLogsKey, filters]`), así cambiar un filtro
   arranca una lista nueva en vez de mezclar cursores de dos consultas.
4. **`data-table.tsx` no se usa.** Ese shell asume paginación **cliente**
   (`rowPaginationFeature` + `createPaginatedRowModel`) y no tiene filas
   expandibles; acá la paginación es de servidor y la fila se despliega. Encajarlo
   obligaría a agregarle features y un modo "sin paginador" que las otras 3 tablas
   no necesitan — más superficie compartida para un solo consumidor. Se usan los
   primitivos `src/components/ui/table.tsx` directo, que es lo que el shell
   envuelve. Tampoco entra TanStack Table: sin orden ni filtro de cliente, no
   aporta nada sobre un `.map()`.
5. **`ip_address` y `user_agent` no salen del servidor.** Hoy **ningún** llamador
   de `logAudit` los escribe (verificado: cero ocurrencias fuera de `lib/audit.ts`
   y del schema), así que serían dos columnas de `null`. Y si mañana se
   registran, son PII de rastreo. Lo conservador y lo lazy coinciden: quedan
   **fuera del `select` del repositorio**, no se filtran en el cliente. Cuando
   haga falta mostrarlas, se agregan con su propio criterio (probablemente solo
   `super_admin`) en un spec que las escriba primero.
6. **El repositorio es de solo lectura, por archivo.** `audit-log.repository.ts`
   no importa ni exporta nada de escritura. El único `INSERT` sigue estando en
   `logAudit` (`src/lib/audit.ts`), que exige `tx`. Esa frontera va comentada en
   la cabecera del repositorio.
7. **Etiquetas: no se extrae nada compartido todavía.** `permission-groups.ts`
   traduce `resource`/`action` de un **permiso**; acá se traduce una **acción de
   auditoría** — otro vocabulario. Lo que sí se reutiliza tal cual es `PERMISSIONS`
   y `ROLES` de `rbac-catalog` para el contenido de la fila expandida. Segundo
   consumidor, no tercero (CLAUDE.md §6): sin extracción.
8. **`from`/`to` se interpretan como día completo en UTC**: `from` → `>= fromT00:00Z`,
   `to` → `< (to+1día)T00:00Z`, para que el "hasta" sea inclusivo (AC4).

## Archivos afectados
| Archivo | Estado |
|---|---|
| `src/server/repositories/audit-log.repository.ts` | nuevo (solo lectura) |
| `src/app/api/admin/audit-logs/route.ts` | nuevo (solo `GET`) |
| `src/modules/audit/{types,schemas,services,hooks,lib,components}/**` | nuevos (6) |
| `src/app/(admin)/admin/audit-logs/page.tsx` | nuevo |
| `src/app/(admin)/admin/layout.tsx` | modificado (item de nav) |

## Tareas
- [x] T1 — `list(params): Promise<{ items, nextCursor }>` — condiciones en `SQL[]`, `leftJoin` a `users` para el actor, `actorId==="system"` → `isNull(actorId)`, keyset por cursor, `orderBy(desc(createdAt), desc(id))`, `limit+1` para calcular `nextCursor`. Sin `ipAddress`/`userAgent` en el `select`. Cabecera con la frontera del `INSERT` · `src/server/repositories/audit-log.repository.ts` · verif: `npm run typecheck` ✓ — cabecera "SOLO LECTURA" con el puntero a `logAudit`; el archivo no importa `Tx` ni ninguna función de escritura. El keyset es una línea de `sql` con comparación de filas y casts explícitos (`::timestamptz`, `::uuid`) para que Postgres no tenga que inferir el tipo de los parámetros dentro del row constructor. El `select` enumera columna por columna: `ip_address`/`user_agent` no están (decisión 5). El actor se arma en JS desde tres campos planos del join, así no se depende de que Drizzle anule el objeto anidado cuando el LEFT no matchea.
- [x] T2 — `listAuditLogsQuerySchema` + tipo inferido, con el refine/transform del cursor · `src/modules/audit/schemas/audit-log.schema.ts` · verif: `npm run typecheck` ✓ — severidad como `z.enum(["info","warning","error"])`, sin tocar `@/lib/permissions` ni el schema Drizzle. El cursor es un `.transform((raw, ctx) => …)`: parte por `|`, rechaza si sobra algún segmento, valida `z.iso.datetime()` + `z.uuid()` y devuelve `{createdAt: Date, id}`; cualquier otra forma es `ctx.addIssue` + `z.NEVER` → issue de Zod → 400 (AC11).
- [x] T3 — `export type { AuditLog }` + `AuditLogRow` + `AuditLogsPage` · `src/modules/audit/types/audit-log.ts` · verif: `npm run lint` ✓ — único punto de contacto del módulo con `server/`, y es `import type`. Suma `AuditActor`, `AuditSeverity` (derivado de `AuditLog["severity"]`) y `AuditLogFilters`, la forma que emite la barra de filtros y consume el service. Comentario `ponytail:` sobre `createdAt`, que llega como string por JSON aunque el tipo diga Date.
- [x] T4 — `GET` con guard `audit_logs.read`, `safeParse` de los search params → `400`, delega en el repo, `console.error` + 500. Ningún otro método exportado · `src/app/api/admin/audit-logs/route.ts` · verif: `npm run typecheck && npm run lint` ✓ — orden exacto: `requirePermission` → `safeParse(Object.fromEntries(searchParams))` → repo. Solo exporta `GET`, así que Next responde 405 a POST/PATCH/DELETE (AC10). `from`/`to` se convierten a día completo UTC acá: `from` → `T00:00:00.000Z`, `to` → arranque del día siguiente comparado con `<` (AC4).
- [x] T5 — `listAuditLogs(query)` con `BASE_URL="/admin/audit-logs"` · `src/modules/audit/services/audit-log.service.ts` · verif: `npm run typecheck` ✓ — `AuditLogFilters & { cursor?: string }`; axios omite las claves `undefined`, así que un filtro vacío no viaja en la query string.
- [x] T6 — `auditLogsKey = ["audit-logs"]` + `useAuditLogs(filters)` con `useInfiniteQuery` · `src/modules/audit/hooks/use-audit-logs.ts` · verif: `npm run lint` ✓ — `initialPageParam: null as string | null`, `getNextPageParam: (last) => last.nextCursor` (v5 corta con `null`) y la key incluye los filtros (decisión 3).
- [x] T7 — `AUDIT_ACTION_LABELS` (las 6 + fallback a la cruda), `ENTITY_LABELS` (`user`→"Persona", `role`→"Puesto"), `SEVERITY` (etiqueta + variante de Badge) y `describeChange(row): string` que arma la frase de la fila expandida usando `PERMISSIONS`/`ROLES` · `src/modules/audit/lib/audit-labels.ts` · verif: `npm run typecheck` ✓ — `actionLabel`/`entityLabel` caen a la cadena cruda si falta la etiqueta (AC8). `describeChange` saca el permiso de `changes.after|before.permissionCode` y el puesto de `metadata.roleSlug`, y los traduce con `PERMISSIONS.description` / `ROLES.name`: "Se quitó el permiso «Eliminar productos» del puesto «Encargado»" (AC7). Severidad → Badge: `info`=secondary, `warning`=outline, `error`=destructive.
- [x] T8 — Barra de filtros controlada (acción, entidad, severidad, actor con `useUsers()`, Desde/Hasta con `<input type="date">`, botón Limpiar); estado local, emite el objeto de filtros hacia arriba · `src/modules/audit/components/audit-logs-filters.tsx` · verif: `npm run lint` ✓ — el estado vive en la tabla (es quien consulta) y la barra es controlada por `value`/`onChange`. Acción y entidad salen de los mapas de etiquetas, sin endpoint de facets (decisión 2); actor es `useUsers()` tal cual + la opción "Sistema". Fechas con `<Input type="date">` nativo, cero dependencias nuevas. El centinela `"all"` y el `null` que puede emitir el Select se normalizan a `undefined` en un solo helper.
- [x] T9 — Tabla: fecha local (`toLocaleString("es-AR")`), actor (email o "Sistema"), acción + Badge de severidad, entidad; fila expandible con la frase de `describeChange` y pares clave/valor de `metadata`; estados de carga (Skeleton), error (mensaje + Reintentar), vacío; botón "Cargar más" según `hasNextPage` · `src/modules/audit/components/audit-logs-table.tsx` · verif: `npm run lint` ✓ — primitivos de `ui/table.tsx` directo, sin `data-table.tsx` ni TanStack Table (decisión 4). Una sola fila expandida por vez (`expandedId`), con `aria-expanded` en el botón. La fila expandida omite `metadata.roleSlug`: ya está en la frase con el nombre del puesto, y repetirlo mostraría el slug crudo. La barra de filtros queda visible también en error, para poder corregir el filtro que rompió.
- [x] T10 — Page con guard `audit_logs.read` → `/sin-acceso`; item "Auditoría" en `NAV_ITEMS` · `src/app/(admin)/admin/audit-logs/page.tsx`, `src/app/(admin)/admin/layout.tsx` · verif: `npm run build` ✓ — mismo patrón que 007/008: `requirePanelAccess()` (memoizado) + `can(...)` → `redirect("/sin-acceso")`. El nav filtra por `audit_logs.read`. `/admin(.*)` del proxy ya cubre la ruta nueva. Build: `/admin/audit-logs` y `/api/admin/audit-logs` compilan como dinámicas.
- [ ] T11 — **PAUSA: validación humana.** Con Fase 0 hecha y `npm run dev`: recorrer AC1–AC11 con sesiones `audit`, `admin` y `manager`. No se marca sin ejecutarlo. → **bloqueada**: Fase 0 (migrate/seed/sync/webhook) no está aplicada, así que no hay sesión ni filas para mirar. AC1–AC11 quedan sin marcar.
- [x] T12 — (review) `parseCursor` puro en `src/modules/audit/lib/cursor.ts` + check runnable con asserts y script `check:audit`, siguiendo el patrón `slug.check.ts` / `rbac.check.ts` · `src/modules/audit/lib/cursor.ts`, `src/modules/audit/lib/audit-labels.check.ts`, `src/modules/audit/schemas/audit-log.schema.ts`, `src/server/repositories/audit-log.repository.ts`, `package.json` · verif: `npm run check:audit` ✓ — el parseo salió del `transform` de Zod a un helper puro que lanza; el schema solo convierte el throw en issue (→ 400) y el repositorio importa de ahí el tipo `AuditLogCursor` en vez de redeclararlo. El check cubre: cursor válido + ida y vuelta, 6 formas inválidas (segmentos de más, basura, sin id, uuid roto, fecha no ISO, mes/día imposibles, vacío), AC7 con `assert.doesNotMatch(/products\.delete|manager/)`, la variante `granted`, la frase sin `metadata` y AC8 (acción desconocida → cruda). Encontró dos cosas al correrlo: `new Date("2026-02-31T…")` no es `NaN` (rueda al 3 de marzo — se acepta y queda documentado con `ponytail:`, el cursor es opaco y lo emite el servidor) y la frase sin puesto leía "Se quitó el puesto un puesto"; `describeChange` ahora arma la contracción (`el`/`al`/`del`) con el nombre calculado una sola vez.

Verificación final: `npm run check:audit && npm run check:rbac && npm run typecheck && npm run lint` (el `build` lo corre el reviewer)

## Riesgos
- **Filas nuevas durante el scroll.** El cursor mira hacia atrás, así que los
  eventos que entran mientras se pagina no aparecen hasta refrescar. Es el
  comportamiento correcto para una bitácora (no se duplica ni se saltea nada,
  AC5), pero conviene que el usuario sepa que la vista es una foto.
- **Sin Fase 0 no hay nada que ver.** El `GET` devuelve `{items: [], nextCursor: null}`
  y la tabla muestra el estado vacío. No es un bug del visor.
- **`entity_id` sin resolver.** Para `entityType:"user"` se muestra el id corto:
  la fila auditada puede apuntar a una persona ya borrada (`actor_id` es
  `SET NULL`, pero `entity_id` es text sin FK). Resolver nombres exigiría un
  segundo join opcional que hoy no paga.

## Deuda aceptada
- Índice compuesto `(created_at desc, id desc)` — y eventualmente
  `(action, created_at desc)` — si la tabla pasa las ~100k filas y el
  `EXPLAIN` muestra sort. Hoy sería optimizar a ciegas.
- `from`/`to` en UTC: para un huso UTC-3, un evento de las 22:00 locales cae en
  el día siguiente del filtro. Se corrige cuando alguien lo note, mandando el
  offset del navegador.
- Sin exportar, sin alertas, sin purga: cada una es su propio plan.
