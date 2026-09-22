// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
// ponytail: `createdAt`/`updatedAt` llegan como string por JSON aunque el tipo
// diga Date. Ninguna vista los renderiza todavía; si alguna lo hace, serializar acá.
import type { Product } from "@/server/db/schema";

export type { Product, ProductListItem } from "@/server/db/schema";

// Fila de la vista de inventario (spec 025): derivada del schema Drizzle, no
// escrita a mano. Deja afuera precio, descripción e imagen: esta pantalla es
// stock y nada más.
export type InventoryRow = Pick<
  Product,
  "id" | "name" | "sku" | "stock" | "reorderPoint" | "isActive"
> & { categoryName: string };
