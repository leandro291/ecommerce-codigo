// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
export type { CartItem } from "@/server/db/schema";
