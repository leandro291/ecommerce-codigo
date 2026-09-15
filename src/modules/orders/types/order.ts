// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
export type { OrderWithItems } from "@/server/repositories/order.repository";
export type { OrderItem, OrderStatus } from "@/server/db/schema";
