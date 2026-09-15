import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { products, type Product } from "./product";
import { users } from "./user";

// Sin tabla `carts`: sin checkout no tendría columnas propias. El carrito es
// "las filas de este usuario".
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Lo usa el upsert atómico del POST: un producto, una fila por usuario.
    uniqueIndex("cart_items_user_product_unique").on(t.userId, t.productId),
    index("cart_items_user_id_idx").on(t.userId),
  ],
);

export type CartItemRow = InferSelectModel<typeof cartItems>;
export type NewCartItem = InferInsertModel<typeof cartItems>;

// Fila que devuelve el repositorio: la cantidad + el precio y el stock vivos del
// producto (JOIN). Sin snapshot de precio: eso recién importa con `orders`.
export type CartItem = Pick<CartItemRow, "productId" | "quantity"> &
  Pick<Product, "name" | "slug" | "imageUrl" | "price" | "stock">;
