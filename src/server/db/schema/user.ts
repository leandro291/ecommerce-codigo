import { sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // Fuente de verdad de la identidad: Clerk. Acá solo el espejo local.
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    // `NULL` hasta que el usuario guarda su primera tarjeta: el Customer de
    // Stripe se crea al vuelo, sin backfill.
    stripeCustomerId: text("stripe_customer_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_clerk_id_unique").on(t.clerkId),
    uniqueIndex("users_email_unique").on(t.email),
    // Postgres admite varios NULL en un índice único: los usuarios sin Customer
    // no chocan entre sí.
    uniqueIndex("users_stripe_customer_id_unique").on(t.stripeCustomerId),
  ],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
