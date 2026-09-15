import axios from "axios";

// Único punto donde el cliente conoce el transporte: los componentes leen
// mensaje y conflicto desde acá, no desde `axios`.

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? error.message;
  }

  return fallback;
}

export function isConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}
