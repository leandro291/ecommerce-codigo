import { api } from "@/lib/axios";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "@/modules/categories/schemas/category.schema";
import type { Category } from "@/modules/categories/types/category";

const BASE_URL = "/admin/categories";

export async function listCategories(
  query: ListCategoriesQuery = {},
): Promise<Category[]> {
  const { data } = await api.get<Category[]>(BASE_URL, { params: query });
  return data;
}

export async function getCategory(id: string): Promise<Category> {
  const { data } = await api.get<Category>(`${BASE_URL}/${id}`);
  return data;
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const { data } = await api.post<Category>(BASE_URL, input);
  return data;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const { data } = await api.patch<Category>(`${BASE_URL}/${id}`, input);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}
