import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import {
  categories,
  type Category,
  type NewCategory,
} from "@/server/db/schema";

export type CategoryFilters = {
  search?: string;
  isActive?: boolean;
};

export async function list(filters: CategoryFilters = {}): Promise<Category[]> {
  const conditions: SQL[] = [];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(
      ilike(categories.name, pattern),
      ilike(categories.slug, pattern),
    );
    if (match) conditions.push(match);
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(categories.isActive, filters.isActive));
  }

  return db
    .select()
    .from(categories)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(categories.position), asc(categories.name));
}

export async function findById(id: string): Promise<Category | undefined> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return category;
}

export async function create(values: NewCategory): Promise<Category> {
  const [category] = await db.insert(categories).values(values).returning();

  return category;
}

export async function update(
  id: string,
  values: Partial<NewCategory>,
): Promise<Category | undefined> {
  const [category] = await db
    .update(categories)
    .set(values)
    .where(eq(categories.id, id))
    .returning();

  return category;
}

export async function remove(id: string): Promise<Category | undefined> {
  const [category] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning();

  return category;
}
