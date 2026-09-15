const UNIQUE_VIOLATION = "23505";
// Postgres distingue el sentido de la violación referencial: un INSERT con FK
// inexistente da 23503, pero un DELETE bloqueado por `ON DELETE RESTRICT` da
// 23001. Verificado contra Neon; cubrir solo 23503 devolvía 500 en vez de 409.
const REFERENTIAL_VIOLATIONS = ["23503", "23001"];

function pgErrorCode(error: unknown): string | undefined {
  // El driver de Neon expone `code` en el error; a veces envuelto en `cause`.
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof (candidate as { code: unknown }).code === "string"
    ) {
      return (candidate as { code: string }).code;
    }
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  const code = pgErrorCode(error);
  return code !== undefined && REFERENTIAL_VIOLATIONS.includes(code);
}

// Nombre del índice violado, para distinguir qué campo duplicó el usuario.
export function violatedConstraint(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "constraint" in candidate &&
      typeof (candidate as { constraint: unknown }).constraint === "string"
    ) {
      return (candidate as { constraint: string }).constraint;
    }
  }

  return undefined;
}
