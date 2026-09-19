// `import type`: se borra en compilación, no arrastra el schema al bundle.
import type { OrderStatus } from "@/server/db/schema";

// Vocabulario único de estados de pedido: el gráfico del dashboard (023), el
// diálogo de compra del cliente y la tabla del panel (024) leen de acá.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  expired: "Expirado",
  fulfilled: "Entregado",
};

// Mismo criterio de VALENCIA que la paleta del gráfico (ver el comentario en
// `orders-status-chart.tsx`): paid/fulfilled bueno, failed malo, expired
// intermedio, pending neutro; la familia avanzada va más saturada. Acá son
// clases de Tailwind porque el badge no tiene las vars de Recharts, y el color
// nunca viaja solo: la etiqueta de texto lo acompaña siempre.
export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fulfilled: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};
