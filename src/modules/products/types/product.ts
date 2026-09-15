// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
// ponytail: `createdAt`/`updatedAt` llegan como string por JSON aunque el tipo
// diga Date. Ninguna vista los renderiza todavía; si alguna lo hace, serializar acá.
export type { Product, ProductListItem } from "@/server/db/schema";
