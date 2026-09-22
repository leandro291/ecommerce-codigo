import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { adjustInventorySchema } from "@/modules/products/schemas/inventory.schema";
import { productIdSchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

type Ctx = RouteContext<"/api/admin/inventory/[id]">;

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("inventory.adjust");

  if (!guard.ok) return guard.response;

  const id = productIdSchema.safeParse((await ctx.params).id);

  if (!id.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: id.error.issues },
      { status: 400 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = adjustInventorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await productRepository.adjustStock({
      id: id.data,
      ...parsed.data,
      // `users.id` local, no el `clerk_id`: es la FK de `audit_logs.actor_id`.
      actorId: guard.user?.id ?? null,
    });

    if (result.ok) return NextResponse.json(result.row);

    return result.reason === "insufficient_stock"
      ? NextResponse.json(
          { error: "El stock no alcanza para ese ajuste" },
          { status: 409 },
        )
      : NextResponse.json(
          { error: "Producto no encontrado" },
          { status: 404 },
        );
  } catch (error) {
    console.error("PATCH /api/admin/inventory/[id]", error);
    return NextResponse.json(
      { error: "No se pudo ajustar el inventario" },
      { status: 500 },
    );
  }
}
