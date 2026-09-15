# E-commerce Tech

Tienda de tecnología construida con **Next.js 16**, con un módulo de **cliente**
(storefront, carrito, checkout con Stripe, perfil) y uno de **administración**
(productos, categorías, usuarios, roles/permisos y auditoría).

El proyecto se desarrolla con IA (Claude Code) bajo una metodología
**SDD — Spec-Driven Development**: ningún código se escribe sin un spec aprobado
por una persona, y la IA trabaja siempre contra documentos versionados en este
repositorio, no contra su memoria.

---

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui ·
Neon Postgres · Drizzle ORM · Clerk · Stripe · TanStack Query v5 ·
TanStack Table v8 · Axios · Zustand · Recharts · Zod · React Hook Form.

Detalle de versiones, estructura de carpetas e instalación en
[docs/SETUP.md](docs/SETUP.md).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar claves de Neon, Clerk y Stripe
npm run db:migrate
npm run db:seed
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias (`node:test` vía `tsx`) |
| `npm run db:generate` / `db:migrate` / `db:studio` / `db:seed` | Drizzle + Neon |

---

## Cómo usamos SDD

Todo pedido pasa por una cadena de agentes definidos en
[`.claude/agents/`](.claude/agents). Cada agente tiene una sola responsabilidad y
termina con un handoff explícito; la sesión principal invoca al siguiente.

```
Pedido
   │
   ▼
┌──────────────┐
│ orchestrator │  ¿SDD o BUILD?
└──────┬───────┘
       │
 ┌─────┴──────────────────────────────────┐
 │                                        │
SDD                                     BUILD
 │                                        │
 ▼                                        ▼
spec ──► ⏸ APROBACIÓN HUMANA ──► developer ⇄ reviewer ──► done
                                    (bucle, máx. 3 vueltas)
```

| Agente | Responsabilidad | Entregable |
|---|---|---|
| **orchestrator** | Clasifica el pedido: SDD (features con datos, dinero, permisos) o BUILD (tareas mecánicas) | Bloque de decisión |
| **spec** | Entiende el requerimiento y escribe un spec con criterios de aceptación, modelo de datos, contratos de API y tareas atómicas. **Se detiene** | `docs/specs/NNN-slug.md` |
| **developer** | Ejecuta las tareas del spec aprobado respetando la arquitectura, SOLID y DRY | Código + tareas marcadas |
| **reviewer** | Audita la implementación contra el spec y la arquitectura; si hay bloqueantes, devuelve al developer | Veredicto + hallazgos |

### Ciclo de vida de un spec

```
draft ──(aprobación humana)──► approved ──► in-progress ──► in-review ──► done
                                                 ▲              │
                                                 └── RECHAZADO ─┘  máx. 3 vueltas
```

- **Ningún código se escribe sobre un spec en `draft`.** La persona responde
  `aprobado` (o pide cambios) y recién ahí entra el developer.
- Si developer ⇄ reviewer no convergen en 3 vueltas, se detiene y se escala a la
  persona. No se sigue girando.
- Los specs en [`docs/specs/`](docs/specs) son la documentación viva del
  proyecto: contexto, decisiones técnicas, contratos y tareas ejecutadas de cada
  feature. Antes de proponer algo nuevo se revisa si ya existe un spec que lo
  cubra.

---

## La IA y la fuente de verdad

La IA no decide la arquitectura ni recuerda el proyecto: **lee** estos
documentos en cada sesión y **gana siempre lo que está escrito en el repo**.

| Fuente de verdad | Qué gobierna |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Contrato de trabajo: flujo SDD, reglas duras, estándares |
| [`docs/SETUP.md`](docs/SETUP.md) | Estructura de carpetas, stack y flujo de datos. No se improvisan rutas fuera de él |
| [`docs/specs/`](docs/specs) | Qué se construye y cómo se acepta, feature por feature |
| [`.claude/agents/`](.claude/agents) | Rol, límites y handoff de cada agente |
| `node_modules/next/dist/docs/` | Docs de la versión instalada de Next.js 16 (tiene breaking changes respecto al entrenamiento del modelo) |

Reglas de uso de la IA:

1. **Clasificar antes de actuar.** Todo pedido pasa primero por `orchestrator`.
2. **Humano en la puerta.** La IA propone el spec; una persona lo aprueba.
3. **Documentación vigente sobre memoria.** Antes de resolver algo del stack, el
   agente usa las *skills* instaladas (docs actuales de Next.js, Clerk, shadcn,
   Stripe…). Si una skill contradice `docs/SETUP.md`, gana `docs/SETUP.md`.
4. **Evidencia antes de declarar hecho.** Ninguna tarea se cierra sin
   `npm run typecheck && npm run lint && npm run build` (y `npm test`) en verde.
5. **Las pruebas no se acomodan.** Si un test revela un bug real, no se cambia el
   valor esperado para que pase: se reporta.
6. **Errores reales, no silencio.** Nada de `catch {}`, `any` ni `@ts-ignore`.

### Reglas duras de arquitectura (bloqueantes en review)

```
Componente → hook (TanStack Query) → service (axios) → Route Handler
           → repositorio → Drizzle → Neon Postgres
```

1. Un componente nunca importa `db`, Drizzle ni un repositorio.
2. Un componente nunca llama `axios`/`fetch` directo: va en `services/` y se consume vía hook.
3. Toda consulta a BD vive en `src/server/repositories/`.
4. Todo Route Handler valida su entrada con Zod antes de tocar datos.
5. Los tipos se infieren del schema Drizzle; no se duplican a mano.
6. Datos de servidor → TanStack Query. Estado de UI → Zustand.
7. `"use client"` lo más abajo posible en el árbol.
8. Rutas de admin protegidas en `proxy.ts` **y** con `requirePermission('<código>')` en el handler. Comparar nombres de rol (`role === 'admin'`) es bloqueante.
9. `audit_logs` es append-only, se escribe en la misma transacción que la mutación y sin PII sensible ni secretos.

### Estándares de código

- TypeScript estricto; SOLID (un archivo, una responsabilidad).
- DRY con criterio: se extrae a la tercera repetición.
- Estados de carga y error obligatorios en toda vista con datos.
- Precios en enteros (céntimos), nunca `float`.
- Componentes shadcn vía `npx shadcn@latest add`, no a mano.
- Comentarios solo para el *porqué* no obvio.

---

## Pruebas

Pruebas unitarias de funciones puras y schemas Zod con `node:test`, junto a
cada archivo en carpetas `__tests__/`. Inventario de lo cubierto y candidatos
pendientes en [docs/unit-test-candidates.md](docs/unit-test-candidates.md).

```bash
npm test
```
