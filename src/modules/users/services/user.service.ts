import { api } from "@/lib/axios";
import type {
  AssignRolesInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "@/modules/users/schemas/user.schema";
import type { UserWithRoles } from "@/modules/users/types/user";

const BASE_URL = "/admin/users";

// El alta devuelve la contraseña temporal una única vez: no se persiste en
// ningún lado y solo vive en memoria del cliente.
export type CreatedUser = {
  user: UserWithRoles;
  temporaryPassword: string;
};

export async function listUsers(
  query: ListUsersQuery = {},
): Promise<UserWithRoles[]> {
  const { data } = await api.get<UserWithRoles[]>(BASE_URL, { params: query });
  return data;
}

export async function createUser(input: CreateUserInput): Promise<CreatedUser> {
  const { data } = await api.post<CreatedUser>(BASE_URL, input);
  return data;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UserWithRoles> {
  const { data } = await api.patch<UserWithRoles>(`${BASE_URL}/${id}`, input);
  return data;
}

// Mismo PATCH que `updateUser`: el permiso se exige por campo presente.
export async function assignRoles(
  id: string,
  input: AssignRolesInput,
): Promise<UserWithRoles> {
  const { data } = await api.patch<UserWithRoles>(`${BASE_URL}/${id}`, input);
  return data;
}

export async function deactivateUser(id: string): Promise<UserWithRoles> {
  const { data } = await api.post<UserWithRoles>(
    `${BASE_URL}/${id}/deactivate`,
  );
  return data;
}
