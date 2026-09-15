// Único punto de contacto del módulo cliente con `server/`. Es `import type`:
// se borra en compilación y no arrastra código de servidor al bundle.
// ponytail: `createdAt`/`updatedAt` llegan como string por JSON aunque el tipo
// diga Date. Ninguna vista los renderiza todavía; si alguna lo hace, serializar acá.
import type { Role, User } from "@/server/db/schema";

export type { Role, User };

// Fila que devuelve `list()`: la persona + sus puestos (JOIN agrupado).
export type UserWithRoles = User & { roles: Role[] };
