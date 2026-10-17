---
id: 001
title: Setup de Clerk vía CLI oficial
status: done
module: auth
scope: both
created: 2026-08-26
---

# 001 — Setup de Clerk vía CLI oficial

## 1. Contexto

El bootstrap dejó `@clerk/nextjs@7.8.2` instalado, un `src/proxy.ts` con
`clerkMiddleware` y un `ClerkProvider` en `src/app/layout.tsx`, pero la aplicación
no está enlazada a ninguna app real de Clerk: `.env.local` contiene claves
placeholder y no hay páginas de `sign-in`/`sign-up` (solo directorios con
`.gitkeep`). No existe UI para iniciar sesión.

Sin esta capa no se puede construir nada del módulo admin ni del historial de
pedidos, porque toda ruta protegida depende de que Clerk resuelva sesión.

Este spec ejecuta el playbook oficial del Clerk CLI sobre un proyecto ya
existente y reconcilia lo que el CLI genere con la arquitectura de
`docs/SETUP.md`.

## 2. Objetivo

Un visitante puede registrarse e iniciar sesión desde el header del storefront, y
`clerk doctor` reporta la instalación en verde, con `npm run typecheck && npm run
lint && npm run build` pasando.

## 3. Alcance

### Incluye

- Instalación/actualización del Clerk CLI global.
- `clerk auth login` (paso interactivo, lo completa el humano en el navegador).
- `clerk init --app app_3ITtYw4T6anWmWyaAdmytpw5nWt` sobre el proyecto existente.
- Reconciliación de `src/proxy.ts` y `src/app/layout.tsx` con lo que escriba el CLI.
- `config.matcher` de `src/proxy.ts` con `'/__clerk/:path*'`.
- `ClerkProvider` dentro de `<body>` con tema `shadcn` de `@clerk/ui`.
- Páginas catch-all `sign-in` y `sign-up`.
- Header del storefront con controles de auth (`SignInButton`, `SignUpButton`,
  `UserButton` bajo `Show`).
- `clerk doctor` en verde y prueba manual del flujo sign-in/sign-up.

### No incluye (explícito)

- Tabla `users` y su sincronización por webhook de Clerk (`user.created/updated/deleted`).
- `src/lib/auth.ts`, `src/lib/permissions.ts`, `requirePermission()`.
- Tablas RBAC (`roles`, `permissions`, `role_permissions`, `user_roles`) y su seed.
- `audit_logs` y eventos `auth.*`.
- Layout ni guard del módulo `(admin)`.
- Cualquier cambio en `DATABASE_URL` o en la conexión a Neon.

## 4. Criterios de aceptación

- [x] AC1 — Dado un terminal limpio, cuando se ejecuta `clerk --version`, entonces
      imprime una versión sin error de comando no encontrado.
- [x] AC2 — Dado el CLI autenticado, cuando se ejecuta `clerk init --app
      app_3ITtYw4T6anWmWyaAdmytpw5nWt`, entonces `.env.local` queda con
      `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` empezando en `pk_` y `CLERK_SECRET_KEY`
      empezando en `sk_`, verificado sin imprimir el valor.
- [x] AC3 — Dado `src/proxy.ts`, cuando se inspecciona `config.matcher`, entonces
      contiene `'/__clerk/:path*'` exactamente una vez, inmediatamente después de
      `'/(api|trpc)(.*)'`.
- [x] AC4 — Dado `src/app/layout.tsx`, cuando se lee el árbol JSX, entonces
      `<ClerkProvider>` está dentro de `<body>` y no envuelve `<html>`.
- [x] AC5 — Dado un visitante anónimo en `/`, cuando carga la home, entonces ve los
      botones "Iniciar sesión" y "Registrarse" en el header y no ve `UserButton`.
- [x] AC6 — Dado un usuario autenticado en `/`, cuando carga la home, entonces ve
      `UserButton` y no ve los botones de sign-in/sign-up.
- [x] AC7 — Dado un visitante anónimo, cuando navega a `/sign-up` y completa el
      registro, entonces vuelve a la app con sesión iniciada.
- [x] AC8 — Dado un usuario anónimo, cuando navega a `/checkout` (ruta no pública),
      entonces `proxy.ts` lo redirige a sign-in.
- [x] AC9 — Cuando se ejecuta `clerk doctor`, entonces no reporta errores.
- [x] AC10 — Cuando se ejecuta `npm run typecheck && npm run lint && npm run build`,
      entonces los tres terminan en verde.
- [x] AC11 — Dado el código fuente completo, cuando se busca `CLERK_SECRET_KEY`,
      entonces no aparece en ningún archivo bajo `src/` (solo en `.env.local`, que
      está en `.gitignore`).

## 5. Modelo de datos

**Sin cambios de esquema.** Clerk es la fuente de verdad de la autenticación; la
autorización en Postgres (`users`, RBAC) es un spec posterior — ver `docs/SETUP.md`
§5.1.

## 6. Contratos de API

No se crea ningún Route Handler propio. La única superficie nueva es el proxy de
Clerk, servido por `clerkMiddleware` desde `src/proxy.ts`:

| Método | Ruta | Auth | Request | Response | Errores |
|---|---|---|---|---|---|
| ALL | `/__clerk/:path*` | gestionado por Clerk | opaco | opaco | los que devuelva Clerk |

Sin schemas Zod: no hay entrada propia que validar en este spec. La regla 4 de
`CLAUDE.md` §4 aplica al primer handler propio, que llega en el spec de webhooks.

Comportamiento de borde vigente en `src/proxy.ts` (no cambia en este spec):

| Matcher | Efecto |
|---|---|
| `/`, `/products(.*)`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/products(.*)`, `/api/categories(.*)`, `/api/webhooks(.*)` | público |
| `/admin(.*)`, `/api/admin(.*)` | `auth.protect()` |
| resto | `auth.protect()` |

## 7. Arquitectura y archivos afectados

- `src/proxy.ts` — añadir `'/__clerk/:path*'` al `config.matcher`. La lógica de
  rutas públicas/admin no se toca.
- `src/app/layout.tsx` — `ClerkProvider` dentro de `<body>`, envolviendo
  `QueryProvider`; `appearance={{ theme: shadcn }}`.
- `src/app/globals.css` — `@import "@clerk/ui/themes/shadcn.css";`.
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — nuevo, `<SignIn />`.
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — nuevo, `<SignUp />`.
- `src/components/shared/header.tsx` — nuevo, Server Component con los controles
  de auth.
- `src/app/(storefront)/layout.tsx` — nuevo, monta el header sobre el storefront.
- `src/app/(storefront)/page.tsx` — la home actual `src/app/page.tsx` se mueve aquí
  para quedar bajo el layout del storefront (`docs/SETUP.md` §3).
- `.env.local` — lo escribe `clerk init`. No se lee ni se imprime su contenido.
- `.env.example` — sin cambios: ya declara las cuatro claves de Clerk.
- `package.json` — `+@clerk/ui`.

Capas no tocadas: `src/server/**`, `src/modules/**`, `src/lib/**`.

## 8. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| `git init` + commit base antes de `clerk init` | Copiar a mano los archivos a un backup | El directorio no es repo git hoy; `clerk init` escribe sobre archivos existentes y sin diff no hay forma de auditar ni revertir lo que tocó. Un commit base es una línea y hace T5 verificable. |
| `clerk init` sin `--framework` ni `--pm` | Pasarlos explícitos | Playbook oficial: en proyecto existente el CLI detecta Next.js y npm; forzarlos puede provocar un scaffolding equivocado. |
| Siempre `--app app_3ITtYw4T6anWmWyaAdmytpw5nWt` | Dejar que el CLI cree una app nueva | La app ya existe; sin el flag el CLI crearía otra y las claves apuntarían al proyecto equivocado. |
| Revisar el diff de `clerk init` y revertir lo que choque con la arquitectura | Aceptar el scaffolding tal cual | `proxy.ts` ya tiene reglas de negocio (públicas/admin) y `layout.tsx` ya monta `QueryProvider`. El CLI no conoce `docs/SETUP.md`; ante conflicto gana `docs/SETUP.md` (`CLAUDE.md` §8). |
| Mantener `clerkMiddleware` en `src/proxy.ts` | Renombrar a `middleware.ts` si el CLI lo genera así | Next 16 renombró el archivo; `docs/SETUP.md` §3 fija `src/proxy.ts`. Dos archivos de borde a la vez es un fallo silencioso de auth. |
| `ClerkProvider` dentro de `<body>` | Dejarlo envolviendo `<html>` como está hoy | Requisito del playbook para Next 15+. |
| `Show` de `@clerk/nextjs` para alternar los controles | `useUser()` en un client component | `Show` está exportado como Server Component (`node_modules/@clerk/nextjs/dist/types/index.d.ts:19`), evita `"use client"` en el header y respeta `CLAUDE.md` §4.7. Sus `when` admiten `"signed-in"`/`"signed-out"` (verificado en los tipos de `@clerk/react`). |
| Header como Server Component en `src/components/shared/` | Componente dentro de `src/modules/auth/` | `docs/SETUP.md` §3 ubica header/footer en `components/shared/`; no existe módulo `auth` en la lista de dominios. |
| Mover la home a `src/app/(storefront)/page.tsx` | Poner el header en el root layout | El root layout es fonts + providers según `docs/SETUP.md` §3. Con la home fuera del grupo, `(storefront)/layout.tsx` nunca la envolvería y AC5 no se cumpliría. |
| `@clerk/ui` + tema `shadcn` | `appearance` con variables a mano | `components.json` existe, así que el paso 8 del playbook aplica. Verificado en el registro: `@clerk/ui@1.30.8` exporta `./themes` y `./themes/shadcn.css`. |
| Sin verificación por permiso en este spec | Añadir `requirePermission()` ya | `CLAUDE.md` §8 exige las dos capas, pero la de permisos depende de las tablas RBAC, que son un spec posterior. Aquí solo queda el borde. Se registra como deuda en §11. |

> Nota de proceso: las skills `clerk-setup` y `clerk-nextjs-patterns` no están
> instaladas en esta sesión. Las decisiones de API se verificaron contra los tipos
> de `@clerk/nextjs@7.8.2` en `node_modules` y contra el registro npm de
> `@clerk/ui`, no contra memoria del modelo.

## 9. Tareas

**T2, T3 y T17 son interactivos: el developer ejecuta el comando y se detiene hasta
que el humano confirma.** No los simule ni los dé por hechos.

- [x] **T1** — Crear repo git y commit base para poder auditar lo que escriba el CLI ·
      comando: `git init && git add -A && git commit -m "chore: base antes de clerk init"` ·
      verificación: `git status --short` sale vacío
- [x] **T2** — Instalar o actualizar el Clerk CLI: si `command -v clerk` responde,
      `clerk update --yes`; si no, `npm install -g clerk` · verificación: `clerk --version`
- [x] **T3** — `clerk auth login` · **PAUSA: el humano completa el login en el
      navegador** · verificación: el CLI confirma sesión activa
- [x] **T4** — `clerk init --app app_3ITtYw4T6anWmWyaAdmytpw5nWt` (sin `--framework`,
      sin `--pm`) · verificación: `grep -c '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="\?pk_' .env.local`
      y `grep -c '^CLERK_SECRET_KEY="\?sk_' .env.local` devuelven `1` cada uno.
      **Nunca imprimir el contenido de `.env.local`.**
- [x] **T5** — Revisar `git diff` de T4 y revertir todo cambio que contradiga
      `docs/SETUP.md`: no duplicar el archivo de borde (`middleware.ts` vs
      `src/proxy.ts`), no perder `QueryProvider` ni las fuentes en `layout.tsx`, no
      perder las reglas de rutas públicas/admin de `proxy.ts` · verificación:
      `npm run typecheck` y un `git diff` que solo contenga cambios justificados
- [x] **T6** — Añadir `"/__clerk/:path*"` al `config.matcher` de `src/proxy.ts`,
      inmediatamente después de `"/(api|trpc)(.*)"` · archivo: `src/proxy.ts` ·
      verificación: `grep -c '__clerk' src/proxy.ts` devuelve `1` y `npm run typecheck`
- [x] **T7** — Mover `<ClerkProvider>` dentro de `<body>`, envolviendo a
      `QueryProvider` · archivo: `src/app/layout.tsx` · verificación: `npm run typecheck`
- [x] **T8** — `npm install @clerk/ui` · verificación: `npm ls @clerk/ui`
- [x] **T9** — Aplicar el tema: `import { shadcn } from "@clerk/ui/themes"` y
      `<ClerkProvider appearance={{ theme: shadcn }}>` · archivo: `src/app/layout.tsx` ·
      verificación: `npm run typecheck`
- [x] **T10** — Añadir `@import "@clerk/ui/themes/shadcn.css";` junto a los demás
      `@import` del inicio · archivo: `src/app/globals.css` · verificación: `npm run build`
- [x] **T11** — Página de sign-in con `<SignIn />` · archivo:
      `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` (eliminar el `.gitkeep` del
      directorio) · verificación: `npm run typecheck`
- [x] **T12** — Página de sign-up con `<SignUp />` · archivo:
      `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` (eliminar el `.gitkeep`) ·
      verificación: `npm run typecheck`
- [x] **T13** — Header del storefront: Server Component con el nombre de la tienda y,
      a la derecha, `<Show when="signed-out">` con `SignInButton` + `SignUpButton`
      (`mode="modal"`) y `<Show when="signed-in">` con `UserButton`. Sin `"use client"` ·
      archivo: `src/components/shared/header.tsx` · verificación: `npm run typecheck`
- [x] **T14** — Layout del storefront que renderiza `<Header />` sobre `{children}` ·
      archivo: `src/app/(storefront)/layout.tsx` · verificación: `npm run typecheck`
- [x] **T15** — Mover `src/app/page.tsx` a `src/app/(storefront)/page.tsx` sin cambiar
      su contenido · verificación: `npm run build` y `/` sigue resolviendo
- [x] **T16** — `clerk doctor` · verificación: salida sin errores; si reporta algo,
      corregirlo antes de continuar
- [x] **T17** — `npm run dev` y probar el flujo completo: registro, cierre de sesión,
      inicio de sesión, y `/checkout` redirigiendo a sign-in · **PAUSA: lo valida el
      humano en el navegador** · verificación: AC5 a AC8
- [x] **T18** — Cierre: `npm run typecheck && npm run lint && npm run build` ·
      verificación: los tres en verde

## 10. Riesgos y consideraciones

- **`clerk init` pisa archivos existentes.** `layout.tsx` y `proxy.ts` ya tienen
  contenido propio. Mitigación: T1 (commit base) + T5 (revisión del diff). Sin T1
  no hay rollback posible.
- **Doble archivo de borde.** Si el CLI genera `src/middleware.ts` además de
  `src/proxy.ts`, Next 16 puede tomar uno solo y dejar rutas sin proteger. T5 debe
  dejar exactamente un archivo de borde: `src/proxy.ts`.
- **Secretos.** `CLERK_SECRET_KEY` no entra en ningún archivo bajo `src/` ni se
  imprime en logs de terminal. Las verificaciones de T4 usan `grep -c`, que devuelve
  un conteo, no el valor. `.env.local` ya está en `.gitignore` — confirmarlo antes
  del commit de T1.
- **Pasos interactivos.** T3 y T17 requieren navegador. Un agente que los "asuma"
  hechos deja el spec falsamente cerrado.
- **Colisión de CSS.** `globals.css` ya importa `shadcn/tailwind.css`; el tema de
  Clerk puede pisar tokens. Si el header o los modales se ven rotos, ajustar el
  orden de los `@import` (Clerk después de Tailwind y shadcn).
- **`(storefront)/layout.tsx` no cubre `(admin)` ni `(auth)`.** Es intencional: el
  header de tienda no debe aparecer en el panel ni en las pantallas de login.
- **Rutas admin sin autorización real.** Tras este spec, `/admin` exige sesión pero
  **cualquier** usuario autenticado pasa el borde. No publicar nada sensible bajo
  `/admin` hasta el spec de RBAC.
- **Rollback.** `git reset --hard` al commit de T1, `npm uninstall @clerk/ui`,
  restaurar `.env.local` a placeholders.

## 11. Fuera de alcance / deuda aceptada

- **Autorización por código de permiso.** `CLAUDE.md` §4.8 exige `requirePermission()`
  en cada handler de `/api/admin/`. Se retoma en el spec de RBAC, que es
  prerrequisito de cualquier endpoint admin.
- **Sincronización `users` ← Clerk.** Sin ella no hay `actor_id` para `audit_logs` ni
  vínculo con `orders`. Se retoma en el spec de webhooks, antes del primer pedido.
- **`src/lib/auth.ts`.** Helpers `requireAuth`/`requireAdmin` de `docs/SETUP.md` §3:
  se crean cuando exista el segundo consumidor, no antes (`CLAUDE.md` §6, DRY a la
  tercera repetición).
- **Diseño del header.** T13 entrega la versión mínima funcional: nombre + controles
  de auth. Navegación, buscador, carrito y footer llegan con sus módulos.
- **`(auth)/layout.tsx`.** No se crea; las páginas de Clerk se centran solas. Se
  añade si el diseño de esas pantallas lo pide.
- **Matcher del proxy por extensión (hallazgo review).** El primer matcher de
  `src/proxy.ts` excluye rutas por extensión (`.xlsx`, `.zip`, …). El spec de RBAC
  debe fijar que toda descarga de admin se sirve bajo `/api/admin/` (cubierta por el
  segundo matcher), nunca como `/admin/export.xlsx`, que saltaría el borde.
- **Webhook de Clerk sin firma (hallazgo review).** `/api/webhooks(.*)` es público por
  diseño y hoy no tiene handler. El spec de webhooks debe verificar la firma svix
  antes de tocar datos: público + sin verificar = endpoint de escritura anónimo.
