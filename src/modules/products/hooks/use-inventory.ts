"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productsKey } from "@/modules/products/hooks/use-products";
import type {
  AdjustInventoryInput,
  InventoryQuery,
} from "@/modules/products/schemas/inventory.schema";
import * as inventoryService from "@/modules/products/services/inventory.service";

export const inventoryKey = ["inventory"] as const;

export function useInventory(filters: InventoryQuery = {}) {
  return useQuery({
    queryKey: [...inventoryKey, filters],
    queryFn: () => inventoryService.listInventory(filters),
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustInventoryInput }) =>
      inventoryService.adjustInventory(id, input),
    // El ajuste mueve el stock, que también se ve en la grilla de productos.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: productsKey });
    },
  });
}
