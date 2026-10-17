# E-commerce Tech

Tienda de tecnología construida con **Next.js 16**, con un módulo de **cliente**
(storefront, carrito, checkout con Stripe, perfil) y uno de **administración**
(productos, categorías, usuarios, roles/permisos y auditoría).

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

## Reglas de arquitectura

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

## Estándares de código

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
