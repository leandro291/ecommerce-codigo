import { and, desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  paymentMethods,
  type NewPaymentMethod,
  type PaymentMethod,
} from "@/server/db/schema";

export async function listByUser(userId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId))
    .orderBy(desc(paymentMethods.createdAt));
}

// `onConflictDoNothing` sobre `payment_methods_stripe_id_unique`: el webhook de
// Stripe reintenta el mismo evento y sin esto la tarjeta se duplicaría.
export async function create(values: NewPaymentMethod): Promise<void> {
  await db.insert(paymentMethods).values(values).onConflictDoNothing({
    target: paymentMethods.stripePaymentMethodId,
  });
}

// El `userId` va en el WHERE, no en un chequeo posterior: una tarjeta ajena
// simplemente no existe para esta consulta.
export async function findOwned(
  userId: string,
  id: string,
): Promise<PaymentMethod | undefined> {
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.id, id)))
    .limit(1);

  return row;
}

export async function deleteOwned(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.id, id)))
    .returning({ id: paymentMethods.id });

  return deleted.length > 0;
}
