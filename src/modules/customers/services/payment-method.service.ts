import { api } from "@/lib/axios";
import type { PaymentMethod } from "@/modules/customers/types/payment-method";

const BASE_URL = "/payment-methods";

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await api.get<PaymentMethod[]>(BASE_URL);
  return data;
}

export async function startCardSetup(): Promise<string> {
  const { data } = await api.post<{ url: string }>(`${BASE_URL}/setup-session`);
  return data.url;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}
