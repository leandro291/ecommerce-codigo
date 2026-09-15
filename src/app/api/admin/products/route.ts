import { NextResponse, type NextRequest } from "next/server";

import {
  isForeignKeyViolation,
  isUniqueViolation,
  violatedConstraint,
} from "@/lib/db-errors";
import { requirePermission } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import { createProductSchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET() {
  const guard = await requirePermission("products.read");

  if (!guard.ok) return guard.response;

  try {
    const products = await productRepository.list();

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/admin/products", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los productos" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission("products.create");

  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { slug, ...rest } = parsed.data;

  try {
    const product = await productRepository.create({
      ...rest,
      slug: slug ?? slugify(rest.name),
    });

    return NextResponse.json(product, { status: 201 });
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

    // La FK es la fuente de verdad: un pre-SELECT tendría race condition.
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: "La categoría indicada no existe" },
        { status: 400 },
      );
    }

    console.error("POST /api/admin/products", error);
    return NextResponse.json(
      { error: "No se pudo crear el producto" },
      { status: 500 },
    );
  }
}
