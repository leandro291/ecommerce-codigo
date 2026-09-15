import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./user";

// Espejo local de la tarjeta: solo la referencia y lo que Stripe deja mostrar
// (`brand` + `last4`). El PAN no está disponible por API ni toca este dominio.
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
    brand: text("brand").notNull(),
    last4: text("last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotencia del webhook: el mismo evento entregado dos veces no duplica
    // la tarjeta (`onConflictDoNothing` se apoya en este índice).
    uniqueIndex("payment_methods_stripe_id_unique").on(t.stripePaymentMethodId),
    index("payment_methods_user_id_idx").on(t.userId),
  ],
);

export type PaymentMethod = InferSelectModel<typeof paymentMethods>;
export type NewPaymentMethod = InferInsertModel<typeof paymentMethods>;
