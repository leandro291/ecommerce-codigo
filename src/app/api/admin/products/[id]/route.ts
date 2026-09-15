import { NextResponse, type NextRequest } from "next/server";

import {
  isForeignKeyViolation,
  isUniqueViolation,
  violatedConstraint,
} from "@/lib/db-errors";
import { requirePermission } from "@/lib/permissions";
import {
  productIdSchema,
  updateProductSchema,
} from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

type Ctx = RouteContext<"/api/admin/products/[id]">;

// Un Response no se puede reutilizar entre requests: se construye uno por llamada.
const notFound = () =>
  NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

async function resolveId(ctx: Ctx) {
  const { id } = await ctx.params;
  return productIdSchema.safeParse(id);
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("products.read");

  if (!guard.ok) return guard.response;

  const id = await resolveId(ctx);

  if (!id.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: id.error.issues },
      { status: 400 },
    );
  }

  try {
    const product = await productRepository.findById(id.data);

    if (!product) return notFound();

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/admin/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener el producto" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("products.update");

  if (!guard.ok) return guard.response;

  const id = await resolveId(ctx);

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

  const parsed = updateProductSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const product = await productRepository.update(id.data, parsed.data);

    if (!product) return notFound();

    return NextResponse.json(product);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        {
          error:
            violatedConstraint(error) === "products_sku_unique"
              ? "Ya existe un producto con ese SKU"
              : "Ya existe un producto con ese slug",
        },
        { status: 409 },
      );
    }

    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: "La categoría indicada no existe" },
        { status: 400 },
      );
    }

    console.error("PATCH /api/admin/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el producto" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("products.delete");

  if (!guard.ok) return guard.response;

  const id = await resolveId(ctx);

  if (!id.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: id.error.issues },
      { status: 400 },
    );
  }

  try {
    const product = await productRepository.remove(id.data);

    if (!product) return notFound();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/admin/products/[id]", error);
    return NextResponse.json(
      { error: "No se pudo borrar el producto" },
      { status: 500 },
    );
  }
}
