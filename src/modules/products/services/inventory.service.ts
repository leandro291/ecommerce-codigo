import { api } from "@/lib/axios";
import type {
  AdjustInventoryInput,
  InventoryQuery,
} from "@/modules/products/schemas/inventory.schema";
import type { InventoryRow } from "@/modules/products/types/product";

const BASE_URL = "/admin/inventory";

export async function listInventory(
  query: InventoryQuery = {},
): Promise<InventoryRow[]> {
  const { data } = await api.get<InventoryRow[]>(BASE_URL, { params: query });
  return data;
}

export async function adjustInventory(
  id: string,
  input: AdjustInventoryInput,
): Promise<InventoryRow> {
  const { data } = await api.patch<InventoryRow>(`${BASE_URL}/${id}`, input);
  return data;
}
