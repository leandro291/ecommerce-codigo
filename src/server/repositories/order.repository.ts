import { and, asc, count, desc, eq, gte, inArray, lt, max, sql, sum } from "drizzle-orm";

import { logAudit } from "@/lib/audit";
import type {
  OrdersByStatusPoint,
  RevenueByDayPoint,
  SalesKpis,
  TopProduct,
} from "@/modules/dashboard/types/metrics";
import { db } from "@/server/db";
import {
  cartItems,
  orderItems,
  orders,
  products,
  type Order,
  type OrderItem,
} from "@/server/db/schema";

// Snapshot que entra a `order_items`: el precio ya congelado, no el vivo.
export type NewOrderLine = {
  productId: string;
  name: string;
  unitPrice: number; // centavos
  quantity: number;
};

export type OrderWithItems = Order & { items: OrderItem[] };

// Una sola transacción: order + ítems + traza. Si algo falla no queda un pedido
// a medias ni una traza de un pedido que no existe.
export async function createPendingOrder(
  userId: string,
  lines: NewOrderLine[],
): Promise<string> {
  // Centavos enteros: sumar los snapshots, nunca un segundo SELECT ni un float.
  const totalAmount = lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({ userId, totalAmount })
      .returning({ id: orders.id });

    await tx
      .insert(orderItems)
      .values(lines.map((line) => ({ ...line, orderId: order.id })));

    await logAudit(tx, {
      actorId: userId,
      action: "order.created",
      entityType: "order",
      entityId: order.id,
      metadata: { totalAmount, itemCount: lines.length },
    });

    return order.id;
  });
}

// Se llama después de crear la sesión: la order nace sin `session_id` porque
// Stripe necesita el `orderId` como idempotency key.
export async function attachSession(
  orderId: string,
  sessionId: string,
): Promise<void> {
  await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(eq(orders.id, orderId));
}

// Firma estable: la comparten la página de éxito y el webhook (spec 018).
export async function getBySessionId(
  sessionId: string,
): Promise<OrderWithItems | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.stripeCheckoutSessionId, sessionId))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.name));

  return { ...order, items };
}

// Solo compras reales: `pending`/`failed`/`expired` no se le muestran a nadie.
const PURCHASED = ["paid", "fulfilled"] as const;

export type OrderRange = {
  from?: Date; // inclusivo
  to?: Date; // exclusivo: lo calcula el handler sumando un día
};

// Historial del propio usuario. El `userId` sale siempre de la sesión, nunca de
// la query: acá no hay forma de pedir las órdenes de otro.
export async function listByUser(
  userId: string,
  range: OrderRange = {},
): Promise<OrderWithItems[]> {
  const conditions = [
    eq(orders.userId, userId),
    inArray(orders.status, PURCHASED),
  ];

  if (range.from) conditions.push(gte(orders.createdAt, range.from));
  if (range.to) conditions.push(lt(orders.createdAt, range.to));

  // `orders_user_created_at_idx` cubre exactamente este WHERE + ORDER BY.
  const rows = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) return [];

  // Una sola query para todos los ítems: un SELECT por orden sería N+1.
  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((order) => order.id),
      ),
    )
    .orderBy(asc(orderItems.name));

  const byOrder = new Map<string, OrderItem[]>();

  for (const item of items) {
    const group = byOrder.get(item.orderId);

    if (group) group.push(item);
    else byOrder.set(item.orderId, [item]);
  }

  return rows.map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] }));
}

// `metadata.orderId` llega de un evento de Stripe: cualquier string. Comparar un
// no-uuid contra la columna `uuid` revienta en Postgres, y ese 500 haría que
// Stripe reintente para siempre.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Camino de rescate del webhook: si `attachSession` falló, la order existe pero
// no tiene `session_id` y `getBySessionId` no la encuentra.
export async function getById(orderId: string): Promise<Order | null> {
  if (!UUID.test(orderId)) return null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return order ?? null;
}

// `alreadyDone` = el UPDATE no matcheó nada porque la order ya no estaba
// `pending`. Sin `order`: no hay nada que cumplir.
export type MarkPaidResult =
  | { alreadyDone: false; order: Order }
  | { alreadyDone: true };

// La idempotencia la da el `status = 'pending'` dentro del propio WHERE: un
// SELECT + `if` deja pasar dos entregas simultáneas del mismo evento.
export async function markPaid(
  sessionId: string,
  paymentIntentId: string | null,
): Promise<MarkPaidResult> {
  const [order] = await db
    .update(orders)
    .set({ status: "paid", stripePaymentIntentId: paymentIntentId })
    .where(
      and(
        eq(orders.stripeCheckoutSessionId, sessionId),
        eq(orders.status, "pending"),
      ),
    )
    .returning();

  return order ? { alreadyDone: false, order } : { alreadyDone: true };
}

// Todo o nada: si un solo ítem no tiene stock, la transacción revierte y la order
// queda `paid` sin descuento parcial ni carrito vaciado a medias.
export async function fulfill(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) throw new Error(`fulfill: no existe la order ${orderId}`);

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      // Un solo UPDATE condicional por ítem: leer el stock y después escribirlo
      // abre un race con otra compra simultánea.
      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
          ),
        )
        .returning({ id: products.id });

      if (updated.length !== 1) {
        throw new Error(
          `fulfill: stock insuficiente para el producto ${item.productId} (order ${orderId})`,
        );
      }
    }

    // Borrado en bloque dentro de la misma tx, no `removeItem` fila por fila.
    await tx.delete(cartItems).where(eq(cartItems.userId, order.userId));

    await logAudit(tx, {
      actorId: null, // lo escribe el webhook, no una persona
      action: "order.paid",
      entityType: "order",
      entityId: orderId,
      // `stripeCheckoutId` y no `sessionId`: `stripSensitive` redacta cualquier
      // clave que contenga "session". Nada de tarjeta ni del payment_intent.
      metadata: {
        stripeCheckoutId: order.stripeCheckoutSessionId,
        totalAmount: order.totalAmount,
        itemCount: items.length,
      },
    });

    await tx
      .update(orders)
      .set({ status: "fulfilled" })
      .where(eq(orders.id, orderId));
  });
}

// Una order ya `paid`/`fulfilled` nunca vuelve atrás: el guard va en el WHERE.
async function markFromPending(
  sessionId: string,
  status: "failed" | "expired",
): Promise<void> {
  await db
    .update(orders)
    .set({ status })
    .where(
      and(
        eq(orders.stripeCheckoutSessionId, sessionId),
        eq(orders.status, "pending"),
      ),
    );
}

export function markFailed(sessionId: string): Promise<void> {
  return markFromPending(sessionId, "failed");
}

export function markExpired(sessionId: string): Promise<void> {
  return markFromPending(sessionId, "expired");
}

// Bordes del rango del dashboard: mismas condiciones opcionales que `listByUser`.
function rangeConditions(range: OrderRange) {
  const conditions = [];

  if (range.from) conditions.push(gte(orders.createdAt, range.from));
  if (range.to) conditions.push(lt(orders.createdAt, range.to));

  return conditions;
}

// KPIs de ventas del dashboard (spec 023). `averageTicket` y `lowStock` no
// salen de acá: los arma el handler con este resultado + `countLowStock()`.
export async function getSalesKpis(
  range: OrderRange,
): Promise<Pick<SalesKpis, "revenue" | "orders">> {
  const [row] = await db
    .select({ revenue: sum(orders.totalAmount), orders: count() })
    .from(orders)
    .where(and(inArray(orders.status, PURCHASED), ...rangeConditions(range)));

  // `sum()` de Postgres es `numeric`: Drizzle lo tipa `string | null`, y un
  // rango sin ventas da `null`. Sin el cast/fallback el KPI muestra NaN.
  return { revenue: Number(row?.revenue ?? 0), orders: row?.orders ?? 0 };
}

// Ingresos por día en la zona local del cliente: el `tzOffset` desplaza el
// `date_trunc` antes de agrupar, así que el `date` que sale ya es el día
// calendario del cliente, como texto listo para el gráfico.
export async function getRevenueByDay(
  range: OrderRange,
  tzOffset: number,
): Promise<RevenueByDayPoint[]> {
  // `tzOffset` interpolado por Drizzle en select/groupBy/orderBy genera un
  // bind param ($N) DISTINTO en cada cláusula aunque el valor sea el mismo;
  // Postgres compara por árbol de expresión, no por valor, y rechaza el
  // GROUP BY ("column must appear in GROUP BY clause"). Por eso se calcula
  // una sola vez, aliasado, y las otras cláusulas referencian el alias
  // (agrupar/ordenar por nombre de columna de salida es SQL estándar).
  const localDay = sql<string>`to_char(date_trunc('day', ${orders.createdAt} - make_interval(mins => ${tzOffset})), 'YYYY-MM-DD')`.as(
    "date",
  );

  const rows = await db
    .select({
      date: localDay,
      revenue: sum(orders.totalAmount),
    })
    .from(orders)
    .where(and(inArray(orders.status, PURCHASED), ...rangeConditions(range)))
    .groupBy(sql`date`)
    .orderBy(sql`date`);

  return rows.map((row) => ({ date: row.date, revenue: Number(row.revenue ?? 0) }));
}

// Top 5 por cantidad vendida. Agrupa por `product_id` solo (no por `name`): si
// el nombre snapshot cambió entre dos compras del mismo producto, `max()` da
// una sola fila igual, no dos.
export async function getTopProducts(range: OrderRange): Promise<TopProduct[]> {
  const rows = await db
    .select({
      productId: orderItems.productId,
      name: max(orderItems.name),
      quantity: sum(orderItems.quantity),
      revenue: sum(sql`${orderItems.unitPrice} * ${orderItems.quantity}`),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(inArray(orders.status, PURCHASED), ...rangeConditions(range)))
    .groupBy(orderItems.productId)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(5);

  return rows.map((row) => ({
    productId: row.productId,
    // `max(text)` no es nullable en la práctica: el GROUP BY solo produce
    // filas con al menos un `order_items.name` real.
    name: row.name ?? "",
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
}

// Distribución por status del rango: a diferencia de las otras tres, no
// filtra por `PURCHASED` (el dashboard quiere ver también `pending`/`failed`).
export async function getOrdersByStatus(
  range: OrderRange,
): Promise<OrdersByStatusPoint[]> {
  const conditions = rangeConditions(range);

  return db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(orders.status);
}
