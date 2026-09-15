import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { isUniqueViolation, violatedConstraint } from "@/lib/db-errors";
// `import type`: se borra en compilación, no arrastra el módulo cliente al server.
import type { UserWithRoles } from "@/modules/users/types/user";
import { db, type Tx } from "@/server/db";
import { roles, users, userRoles, type User } from "@/server/db/schema";

export type UserFilters = {
  id?: string;
  search?: string;
  isActive?: boolean;
};

// Un solo JOIN en vez de una consulta de puestos por fila (N+1): vienen filas
// planas (una por par usuario-puesto) y se agrupan acá.
export async function list(
  filters: UserFilters = {},
): Promise<UserWithRoles[]> {
  const conditions: SQL[] = [];

  if (filters.id) conditions.push(eq(users.id, filters.id));

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(
      ilike(users.email, pattern),
      ilike(users.firstName, pattern),
      ilike(users.lastName, pattern),
    );
    if (match) conditions.push(match);
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive));
  }

  const rows = await db
    .select({ user: users, role: roles })
    .from(users)
    // LEFT: alguien sin puesto asignado tiene que seguir apareciendo.
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt), asc(roles.slug));

  // El Map conserva el orden de inserción, que es el `desc(createdAt)` del SELECT.
  const byId = new Map<string, UserWithRoles>();

  for (const row of rows) {
    let entry = byId.get(row.user.id);

    if (!entry) {
      entry = { ...row.user, roles: [] };
      byId.set(row.user.id, entry);
    }

    if (row.role) entry.roles.push(row.role);
  }

  return [...byId.values()];
}

// Cuenta con `FOR UPDATE OF users` dentro de la transacción: sin el lock, dos
// desactivaciones concurrentes leen "quedan 2" y dejan el sistema sin dueño.
// Devuelve filas y cuenta en JS porque Postgres no admite FOR UPDATE con
// funciones de agregación.
export async function countActiveByRoleSlug(
  tx: Tx,
  slug: string,
): Promise<number> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.slug, slug), eq(users.isActive, true)))
    .for("update", { of: users });

  return rows.length;
}

// Destinatarios del resync de `publicMetadata` cuando cambia la matriz de un
// puesto. Solo activos: a quien está dado de baja no le cambia nada (sus
// permisos ya resuelven vacío) y sería una llamada de red a Clerk al pedo.
export async function listClerkIdsByRoleId(
  roleId: string,
): Promise<string[]> {
  const rows = await db
    .select({ clerkId: users.clerkId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.roleId, roleId), eq(users.isActive, true)));

  return rows.map((row) => row.clerkId);
}

// Espejo local de la identidad de Clerk: lo que este proyecto guarda de un
// `UserJSON`. Lo comparten el webhook y el backfill.
export type ClerkUserInput = {
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

export async function findByClerkId(
  clerkId: string,
): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return user;
}

export async function findById(id: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user;
}

// Sin `tx`: no se audita (es dato del propio usuario, no acción administrativa)
// y el Customer ya existe en Stripe cuando se llama.
export async function setStripeCustomerId(
  id: string,
  customerId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ stripeCustomerId: customerId })
    .where(eq(users.id, id));
}

// `created` sale de si el INSERT devolvió fila, no de comparar timestamps: es lo
// que hace idempotente a la auditoría cuando Svix reintenta el mismo evento.
// `reclaimedFrom` solo viene en la rama de rescate: es el clerk_id viejo que
// quedó huérfano, y va a la traza para poder reconstruir la fusión.
export async function upsertByClerkId(
  tx: Tx,
  values: ClerkUserInput,
): Promise<{ user: User; created: boolean; reclaimedFrom?: string }> {
  const columns = {
    clerkId: values.clerkId,
    email: values.email,
    firstName: values.firstName ?? null,
    lastName: values.lastName ?? null,
    imageUrl: values.imageUrl ?? null,
  };

  let inserted: User | undefined;

  try {
    // Savepoint: si el INSERT choca contra `users_email_unique`, Postgres aborta
    // la transacción entera y la rama de rescate no podría ejecutar nada.
    inserted = await tx.transaction(async (sp) => {
      const [row] = await sp
        .insert(users)
        .values(columns)
        .onConflictDoNothing({ target: users.clerkId })
        .returning();

      return row;
    });
  } catch (error) {
    if (
      !isUniqueViolation(error) ||
      violatedConstraint(error) !== "users_email_unique"
    ) {
      throw error;
    }

    // Cuenta borrada en Clerk y vuelta a crear con el mismo email: llega un
    // clerk_id nuevo sobre una fila que ya existe. Se re-apunta y se reactiva.
    const [previous] = await tx
      .select({ clerkId: users.clerkId })
      .from(users)
      .where(eq(users.email, values.email))
      .limit(1);

    const [reclaimed] = await tx
      .update(users)
      .set({ ...columns, isActive: true })
      .where(eq(users.email, values.email))
      .returning();

    if (!reclaimed) throw error;

    return { user: reclaimed, created: true, reclaimedFrom: previous?.clerkId };
  }

  if (inserted) return { user: inserted, created: true };

  const [updated] = await tx
    .update(users)
    .set({
      email: columns.email,
      firstName: columns.firstName,
      lastName: columns.lastName,
      imageUrl: columns.imageUrl,
    })
    .where(eq(users.clerkId, values.clerkId))
    .returning();

  return { user: updated, created: false };
}

// Solo perfil: el email lo dueña Clerk y `is_active` tiene su propia función.
export async function updateProfile(
  tx: Tx,
  id: string,
  values: { firstName?: string | null; lastName?: string | null },
): Promise<User | undefined> {
  const [user] = await tx
    .update(users)
    .set(values)
    .where(eq(users.id, id))
    .returning();

  return user;
}

// Baja lógica, no física: `audit_logs.actor_id` referencia esta fila y borrarla
// haría perder la identidad del actor en trazas viejas.
export async function deactivateByClerkId(
  tx: Tx,
  clerkId: string,
): Promise<User | undefined> {
  // El filtro por `is_active` es lo que hace idempotente la auditoría: un
  // segundo `user.deleted` no devuelve fila y no se audita de nuevo.
  const [user] = await tx
    .update(users)
    .set({ isActive: false })
    .where(and(eq(users.clerkId, clerkId), eq(users.isActive, true)))
    .returning();

  return user;
}

export async function revokeAllRoles(tx: Tx, userId: string): Promise<void> {
  await tx.delete(userRoles).where(eq(userRoles.userId, userId));
}

// `tx` obligatorio: asignar y revocar puestos se audita en la misma transacción
// (SETUP.md §5.2 regla 2).
export async function assignRole(
  tx: Tx,
  values: { userId: string; roleId: string; assignedBy?: string | null },
): Promise<void> {
  await tx.insert(userRoles).values(values).onConflictDoNothing();
}

export async function revokeRole(
  tx: Tx,
  userId: string,
  roleId: string,
): Promise<void> {
  await tx
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
}
