import { z } from "zod";

// Del catálogo puro, no de `@/lib/permissions`: este schema lo consume el
// diálogo en el cliente y `permissions.ts` arrastra `next/server` y la conexión
// a la base (decisión 1 del spec 007).
import { PERMISSIONS } from "@/lib/rbac-catalog";

export const permissionCodeSchema = z.enum(
  PERMISSIONS.map((permission) => permission.code),
);

// El handler deduplica con `new Set` antes de tocar la base: repetir un código
// no es un error del cliente, es ruido.
export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(permissionCodeSchema),
});

export const roleIdSchema = z.uuid("Identificador inválido");

export type UpdateRolePermissionsInput = z.infer<
  typeof updateRolePermissionsSchema
>;
