import { and, asc, count, desc, eq, ilike, lte, or, type SQL } from "drizzle-orm";

import type { PublicProductQuery } from "@/modules/products/schemas/product.schema";
import { db } from "@/server/db";
import {
  categories,
  products,
  type NewProduct,
  type Product,
  type ProductListItem,
} from "@/server/db/schema";

// Proyección compartida por `list()` y `listPublic()`: si se agrega una columna
// al schema, se agrega una sola vez acá.
const listColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  description: products.description,
  categoryId: products.categoryId,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  sku: products.sku,
  stock: products.stock,
  imageUrl: products.imageUrl,
  isActive: products.isActive,
  isFeatured: products.isFeatured,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  categoryName: categories.name,
};

// Órdenes soportados por la query pública. El desempate por nombre deja la
// grilla estable entre recargas cuando dos productos comparten precio.
const ORDER_BY: Record<PublicProductQuery["sort"], SQL[]> = {
  relevance: [desc(products.isFeatured), asc(products.name)],
  "price-asc": [asc(products.price), asc(products.name)],
  "price-desc": [desc(products.price), asc(products.name)],
};

// Un solo JOIN en vez de una consulta de categoría por fila (N+1).
export async function list(): Promise<ProductListItem[]> {
  return db
    .select(listColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name));
}

// Condiciones de la vista pública, compartidas por `listPublic` y `countPublic`:
// el conteo tiene que filtrar exactamente igual que la página o el total de
// páginas miente. `isActive` no es un filtro opcional sino una condición fija,
// para que ningún llamador pueda pedir productos dados de baja.
function buildPublicConditions(filters: Partial<PublicProductQuery>): SQL[] {
  const conditions: SQL[] = [eq(products.isActive, true)];

  if (filters.featured !== undefined) {
    conditions.push(eq(products.isFeatured, filters.featured));
  }

  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(
      ilike(products.name, pattern),
      ilike(products.description, pattern),
    );
    if (match) conditions.push(match);
  }

  return conditions;
}

// Los filtros son los de la query pública; `Partial` porque `limit` y `page`
// traen default en el schema pero acá pueden omitirse.
export async function listPublic(
  filters: Partial<PublicProductQuery> = {},
): Promise<ProductListItem[]> {
  const limit = filters.limit ?? 12;
  const page = filters.page ?? 1;

  return db
    .select(listColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...buildPublicConditions(filters)))
    .orderBy(...ORDER_BY[filters.sort ?? "relevance"])
    .limit(limit)
    .offset((page - 1) * limit);
}

// Total de la vista pública con los mismos filtros que `listPublic`: mismo JOIN
// (la condición por `categories.slug` lo necesita) y las mismas condiciones, sin
// `limit` ni `offset`.
export async function countPublic(
  filters: Partial<PublicProductQuery> = {},
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...buildPublicConditions(filters)));

  return row?.total ?? 0;
}

// Ficha pública: mismo criterio que `listPublic` — un producto dado de baja no
// existe para el storefront, y quien lo pida se lleva `undefined` (→ 404).
export async function findPublicBySlug(
  slug: string,
): Promise<ProductListItem | undefined> {
  const [product] = await db
    .select(listColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  return product;
}

export async function findById(id: string): Promise<Product | undefined> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return product;
}

export async function create(values: NewProduct): Promise<Product> {
  const [product] = await db.insert(products).values(values).returning();

  return product;
}

export async function update(
  id: string,
  values: Partial<NewProduct>,
): Promise<Product | undefined> {
  const [product] = await db
    .update(products)
    .set(values)
    .where(eq(products.id, id))
    .returning();

  return product;
}

export async function remove(id: string): Promise<Product | undefined> {
  const [product] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();

  return product;
}

// No hay columna `reorder_point` (eso es el spec 025): el umbral es fijo acá.
export const LOW_STOCK_THRESHOLD = 5;

// KPI del dashboard (spec 023): solo cuenta productos activos, uno dado de
// baja con poco stock no es una alerta para nadie.
export async function countLowStock(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .where(
      and(lte(products.stock, LOW_STOCK_THRESHOLD), eq(products.isActive, true)),
    );

  return row?.total ?? 0;
}
