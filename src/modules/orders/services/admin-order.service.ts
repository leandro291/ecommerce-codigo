import { api } from "@/lib/axios";
import type {
  AdminOrderFilters,
  AdminOrdersPage,
} from "@/modules/orders/types/order";

const BASE_URL = "/admin/orders";

// El `cursor` y el `tzOffset` no vienen de la barra de filtros: el primero lo
// pone el hook desde el `pageParam` de `useInfiniteQuery` y el segundo sale del
// navegador. Axios omite las claves `undefined` al armar el query string.
export async function listAdminOrders(
  query: AdminOrderFilters & { tzOffset?: number; cursor?: string } = {},
): Promise<AdminOrdersPage> {
  const { data } = await api.get<AdminOrdersPage>(BASE_URL, { params: query });
  return data;
}
