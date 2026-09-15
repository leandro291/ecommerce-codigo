import { and, asc, eq, sql } from "drizzle-orm";

import { MAX_QUANTITY } from "@/modules/cart/schemas/cart.schema";
import { db } from "@/server/db";
import { cartItems, products, type CartItem } from "@/server/db/schema";

// Proyección única del carrito: cantidad propia + datos vivos del producto.
const itemColumns = {
  productId: cartItems.productId,
  quantity: cartItems.quantity,
  name: products.name,
  slug: products.slug,
  imageUrl: products.imageUrl,
  price: products.price,
  stock: products.stock,
};

// Un solo JOIN, nunca una consulta de producto por fila (N+1). Un producto dado
// de baja desaparece del carrito sin borrar la fila: si vuelve, vuelve el ítem.
export async function listByUser(userId: string): Promise<CartItem[]> {
  return db
    .select(itemColumns)
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(and(eq(cartItems.userId, userId), eq(products.isActive, true)))
    .orderBy(asc(products.name));
}

// Upsert atómico: suma sin leer antes, así dos pestañas agregando a la vez no
// se pisan. `least` respeta el tope aunque la suma lo pase.
export async function addItem(
  userId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await db
    .insert(cartItems)
    .values({ userId, productId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: {
        quantity: sql`least(${cartItems.quantity} + excluded.quantity, ${MAX_QUANTITY})`,
        // `$onUpdate` no corre en un `ON CONFLICT`: se fija a mano.
        updatedAt: new Date(),
      },
    });
}

export async function setQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<boolean> {
  const updated = await db
    .update(cartItems)
    .set({ quantity })
    .where(
      and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
    )
    .returning({ id: cartItems.id });

  return updated.length > 0;
}

export async function removeItem(
  userId: string,
  productId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(cartItems)
    .where(
      and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
    )
    .returning({ id: cartItems.id });

  return deleted.length > 0;
}
