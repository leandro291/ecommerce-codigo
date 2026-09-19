// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
import type { Order, OrderStatus } from "@/server/db/schema";

export type { OrderWithItems } from "@/server/repositories/order.repository";
export type { Order, OrderItem, OrderStatus } from "@/server/db/schema";

// Identidad mínima de quien compró, para la columna Cliente del panel.
export type OrderCustomer = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

// Los dos ids de Stripe no salen del servidor: son de la pasarela y esta vista
// no los muestra, así que directamente no están en el `select` del repositorio.
// ponytail: `createdAt` llega como string por JSON aunque el tipo diga Date.
// La tabla lo envuelve en `new Date(...)` antes de formatear.
export type AdminOrderRow = Omit<
  Order,
  "stripeCheckoutSessionId" | "stripePaymentIntentId"
> & {
  customer: OrderCustomer;
};

export type AdminOrdersPage = {
  items: AdminOrderRow[];
  nextCursor: string | null;
};

// Lo que la barra de filtros emite. Ni el `cursor` ni el `tzOffset` están acá:
// el primero lo pone el hook desde `pageParam` y el segundo sale del navegador,
// no de una decisión de quien filtra.
export type AdminOrderFilters = {
  // `YYYY-MM-DD`, tal cual lo emite `<input type="date">`.
  from?: string;
  to?: string;
  status?: OrderStatus;
  // Coincidencia parcial contra email, nombre o apellido del cliente.
  search?: string;
};
