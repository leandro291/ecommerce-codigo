import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

// `neon-serverless` (WebSocket) en vez de `neon-http`: es el único de los dos que
// soporta `db.transaction()`. Una sola instancia módulo-scope; el pool no se
// cierra por request.
export const db = drizzle(new Pool({ connectionString }), { schema });

// Handle transaccional que reciben `logAudit` y los repos que escriben dentro
// de `db.transaction()`.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
