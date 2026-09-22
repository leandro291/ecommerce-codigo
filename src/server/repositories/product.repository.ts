import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type { InventoryQuery } from "@/modules/products/schemas/inventory.schema";
import type { PublicProductQuery } from "@/modules/products/schemas/product.schema";
// `import type`: se borra en compilación, no arrastra el módulo cliente al server.
import type { InventoryRow } from "@/modules/products/types/product";
import { db, type Tx } from "@/server/db";
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
  reorderPoint: products.reorderPoint,
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

// "Hay que reponer": comparación entre dos columnas de la misma fila, no contra
// una constante (spec 025). Se comparte entre el KPI, el filtro y el orden.
const isLowStock = lte(products.stock, products.reorderPoint);

// KPI del dashboard (spec 023): solo cuenta productos activos, uno dado de
// baja con poco stock no es una alerta para nadie.
export async function countLowStock(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .where(and(isLowStock, eq(products.isActive, true)));

  return row?.total ?? 0;
}

// --- Inventario (spec 025) -------------------------------------------------

const inventoryColumns = {
  id: products.id,
  name: products.name,
  sku: products.sku,
  stock: products.stock,
  reorderPoint: products.reorderPoint,
  isActive: products.isActive,
  categoryName: categories.name,
};

// Sin paginación de servidor: la lista es del tamaño del catálogo y la tabla
// pagina en cliente. El orden por defecto deja arriba lo que hay que reponer y,
// dentro de eso, lo más urgente primero (AC2).
export async function listInventory(
  filters: InventoryQuery = {},
): Promise<InventoryRow[]> {
  const conditions: SQL[] = [];

  if (filters.onlyLow) conditions.push(isLowStock);
  if (filters.category) {
    conditions.push(eq(products.categoryId, filters.category));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conditions.push(match);
  }

  return db
    .select(inventoryColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(isLowStock), asc(products.stock), asc(products.name));
}

function findInventoryRow(
  tx: Tx,
  id: string,
): Promise<InventoryRow | undefined> {
  return tx
    .select(inventoryColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1)
    .then((rows) => rows[0]);
}

export type AdjustStockParams = {
  id: string;
  delta?: number;
  reorderPoint?: number;
  actorId: string | null;
};

// `insufficient_stock` y `not_found` los mapea el handler a 409 y 404.
export type AdjustStockResult =
  | { ok: true; row: InventoryRow }
  | { ok: false; reason: "not_found" | "insufficient_stock" };

// Todo en una transacción: el UPDATE y su traza viven o mueren juntos
// (CLAUDE.md regla 9).
export async function adjustStock({
  id,
  delta,
  reorderPoint,
  actorId,
}: AdjustStockParams): Promise<AdjustStockResult> {
  return db.transaction(async (tx) => {
    if (delta !== undefined) {
      // Delta aplicado en SQL con el no-negativo en el WHERE: leer el stock y
      // después escribirlo perdería el ajuste de una reposición simultánea.
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${delta}` })
        .where(
          and(
            eq(products.id, id),
            gte(sql`${products.stock} + ${delta}`, 0),
          ),
        )
        .returning({ stock: products.stock });

      // Cero filas: o no existe el producto o el stock no alcanza. Una lectura
      // posterior distingue los dos casos.
      if (!updated) {
        const current = await findInventoryRow(tx, id);

        return {
          ok: false,
          reason: current ? "insufficient_stock" : "not_found",
        };
      }

      await logAudit(tx, {
        actorId,
        action: "product.stock_adjusted",
        entityType: "product",
        entityId: id,
        // El stock previo sale del resultado, no de un SELECT anterior: el
        // UPDATE ya devolvió el valor final y el delta es conocido.
        changes: {
          before: { stock: updated.stock - delta },
          after: { stock: updated.stock },
        },
        metadata: { delta },
      });
    }

    if (reorderPoint !== undefined) {
      const [before] = await tx
        .select({ reorderPoint: products.reorderPoint })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      if (!before) return { ok: false, reason: "not_found" };

      // Reenviar el mismo valor no es un cambio: sin esto, abrir y guardar el
      // diálogo ensuciaría la bitácora con trazas de nada.
      if (before.reorderPoint !== reorderPoint) {
        await tx
          .update(products)
          .set({ reorderPoint })
          .where(eq(products.id, id));

        await logAudit(tx, {
          actorId,
          action: "product.reorder_point_updated",
          entityType: "product",
          entityId: id,
          changes: {
            before: { reorderPoint: before.reorderPoint },
            after: { reorderPoint },
          },
        });
      }
    }

    const row = await findInventoryRow(tx, id);

    return row ? { ok: true, row } : { ok: false, reason: "not_found" };
  });
}
