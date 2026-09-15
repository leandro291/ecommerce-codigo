import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

// `fulfilled` está separado de `paid` para que el fulfillment (spec 018) sea
// reintentable sin volver a cobrar.
export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "expired",
  "fulfilled",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // RESTRICT: un pedido es historia contable, no se va con el usuario.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    currency: text("currency").notNull().default("pen"),
    // Centavos, nunca float: suma de los ítems al crear la sesión.
    totalAmount: integer("total_amount").notNull(),
    // Nullable: la order nace antes de que Stripe devuelva la sesión.
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Único: es la clave con la que el webhook (018) encuentra el pedido.
    uniqueIndex("orders_stripe_checkout_session_id_unique").on(
      t.stripeCheckoutSessionId,
    ),
    index("orders_user_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("orders_status_idx").on(t.status),
  ],
);

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
export type OrderStatus = Order["status"];
