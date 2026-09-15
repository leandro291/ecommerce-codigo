// Único lugar donde un sol se vuelve céntimo y viceversa. Un segundo `* 100`
// en el código es un bug esperando: `19.99 * 100 === 1998.9999...` y `trunc`
// pierde un céntimo. El self-check de `money.check.ts` fija el redondeo.

export function toCents(soles: number): number {
  return Math.round(soles * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

const formatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function formatPrice(cents: number): string {
  return formatter.format(fromCents(cents));
}
