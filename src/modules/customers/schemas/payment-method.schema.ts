import { z } from "zod";

// Único dato de entrada de todo el módulo: el id del DELETE. Un formato roto es
// un id que no existe, así que el handler lo trata como 404.
export const paymentMethodIdParamSchema = z.object({ id: z.uuid() });
