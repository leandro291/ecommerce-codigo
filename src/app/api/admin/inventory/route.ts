import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/lib/permissions";
import { inventoryQuerySchema } from "@/modules/products/schemas/inventory.schema";
import * as productRepository from "@/server/repositories/product.repository";

// Solo lectura: el ajuste vive en `[id]/route.ts`. Este archivo no exporta
// POST/PATCH/DELETE, así que Next responde 405 solo.
export async function GET(request: NextRequest) {
  const guard = await requirePermission("inventory.read");

  if (!guard.ok) return guard.response;

  const query = inventoryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await productRepository.listInventory(query.data),
    );
  } catch (error) {
    console.error("GET /api/admin/inventory", error);
    return NextResponse.json(
      { error: "No se pudo obtener el inventario" },
      { status: 500 },
    );
  }
}
