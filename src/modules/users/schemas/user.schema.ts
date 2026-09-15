import { z } from "zod";

// Del catálogo puro, no de `@/lib/permissions`: este schema lo consume el
// `zodResolver` en el cliente y `permissions.ts` arrastra `next/server` y la
// conexión a la base.
import { ROLES } from "@/lib/rbac-catalog";

export const roleSlugSchema = z.enum(ROLES.map((role) => role.slug));

const nameSchema = z
  .string()
  .trim()
  .max(80, "No puede superar los 80 caracteres");

export const createUserSchema = z.object({
  email: z.email("Email inválido"),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  roleSlug: roleSlugSchema,
});

export const updateUserSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    roleSlugs: z.array(roleSlugSchema).optional(),
  })
  .refine((values) => Object.keys(values).length > 0, "Nada para actualizar");

// Resolver del diálogo de puestos; el handler valida con `updateUserSchema`.
export const assignRolesSchema = z.object({
  roleSlugs: z.array(roleSlugSchema),
});

export const userIdSchema = z.uuid("Identificador inválido");

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export type RoleSlugInput = z.infer<typeof roleSlugSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
