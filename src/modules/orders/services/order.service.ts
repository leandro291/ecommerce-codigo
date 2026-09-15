import { api } from "@/lib/axios";
import type { OrderRangeQuery } from "@/modules/orders/schemas/order.schema";
import type { OrderWithItems } from "@/modules/orders/types/order";

const BASE_URL = "/orders";

export async function listOrders(
  range: OrderRangeQuery,
): Promise<OrderWithItems[]> {
  const { data } = await api.get<OrderWithItems[]>(BASE_URL, {
    params: range,
  });
  return data;
}

export async function getReceiptUrl(orderId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(
    `${BASE_URL}/${orderId}/receipt`,
  );
  return data.url;
}
