import { randomInt } from "node:crypto";

// Contraseña temporal que se muestra una sola vez al dar de alta a alguien del
// panel. `randomInt` es el CSPRNG de Node sin sesgo de módulo; `Math.random` no
// sirve para una credencial.

// Sin caracteres ambiguos (0/O, 1/l/I): esta contraseña se dicta o se copia a
// mano, y un cero leído como o mayúscula es un ticket de soporte.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%*?-_";

const CLASSES = [LOWER, UPPER, DIGIT, SYMBOL] as const;
const ALPHABET = CLASSES.join("");
const LENGTH = 16;

function pick(source: string): string {
  return source[randomInt(source.length)];
}

export function generateTemporaryPassword(): string {
  // Una de cada clase primero: garantiza que pase las reglas de complejidad de
  // Clerk sin depender de la suerte del sorteo.
  const chars = CLASSES.map(pick);

  while (chars.length < LENGTH) chars.push(pick(ALPHABET));

  // Fisher-Yates: sin barajar, las 4 primeras posiciones tendrían clase fija.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
