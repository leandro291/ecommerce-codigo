"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProductFormValues } from "@/modules/products/schemas/product.schema";
import * as productService from "@/modules/products/services/product.service";

export const productsKey = ["products"] as const;

export function useProducts() {
  return useQuery({
    queryKey: productsKey,
    queryFn: () => productService.listProducts(),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProductFormValues) => productService.createProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductFormValues }) =>
      productService.updateProduct(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
}
