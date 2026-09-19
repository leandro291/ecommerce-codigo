// Cursor keyset compartido: `"<createdAt ISO 8601>|<uuid de la fila>"`, tomado
// de la última fila devuelta. Texto plano, no base64: es opaco igual para el
// cliente y ahorra el ida y vuelta de codificación. Lo usan la bitácora (009) y
// los pedidos del panel (024); vive en `lib/` para que orders no importe audit.
//
// Lógica pura y sin zod a propósito: el schema lo envuelve para convertir el
// throw en un issue (→ 400) y `audit-labels.check.ts` lo corre con tsx.

const ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type KeysetCursor = { createdAt: Date; id: string };

export function parseCursor(raw: string): KeysetCursor {
  const [createdAt, id, ...extra] = raw.split("|");

  if (extra.length > 0) throw new Error("Cursor inválido: sobran segmentos");
  if (!createdAt || !ISO.test(createdAt)) {
    throw new Error("Cursor inválido: fecha no ISO 8601");
  }
  if (!id || !UUID.test(id)) throw new Error("Cursor inválido: id no es uuid");

  const date = new Date(createdAt);

  // La forma puede ser ISO y la fecha no existir ("2026-99-99T…").
  // ponytail: `Date` rueda las fechas casi-válidas ("2026-02-31" → 3 de marzo)
  // en vez de fallar, y se acepta: el cursor lo emite el servidor, es opaco y
  // solo mueve el punto desde el que se pagina hacia atrás.
  if (Number.isNaN(date.getTime())) {
    throw new Error("Cursor inválido: fecha inexistente");
  }

  return { createdAt: date, id };
}
