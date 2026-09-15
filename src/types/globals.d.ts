import type { PanelMetadata } from "@/lib/clerk-sync";

// Clerk tipa `sessionClaims` como `JwtPayload & CustomJwtSessionClaims`, y la
// interfaz vacía por defecto impide leer `.metadata.panel` con `strict`.
// El claim lo llena el paso manual del dashboard: Sessions → Customize session
// token → {"metadata": "{{user.public_metadata}}"}. Opcional a propósito: si no
// está configurado llega `undefined` y el borde deja pasar (spec 006 §6).
declare global {
  interface CustomJwtSessionClaims {
    metadata?: PanelMetadata;
  }
}

export {};
