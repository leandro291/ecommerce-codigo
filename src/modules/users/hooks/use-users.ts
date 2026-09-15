"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AssignRolesInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "@/modules/users/schemas/user.schema";
import * as userService from "@/modules/users/services/user.service";

export const usersKey = ["users"] as const;

export function useUsers(query: ListUsersQuery = {}) {
  return useQuery({
    queryKey: [...usersKey, query],
    queryFn: () => userService.listUsers(query),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => userService.createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      userService.updateUser(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignRolesInput }) =>
      userService.assignRoles(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userService.deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}
