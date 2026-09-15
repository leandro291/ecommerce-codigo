import { NextResponse, type NextRequest } from "next/server";

import { isUniqueViolation } from "@/lib/db-errors";
import { requirePermission } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

export async function GET(request: NextRequest) {
  const guard = await requirePermission("categories.read");

  if (!guard.ok) return guard.response;

  const query = listCategoriesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!query.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: query.error.issues },
      { status: 400 },
    );
  }

  try {
    const categories = await categoryRepository.list({
      search: query.data.search,
      isActive:
        query.data.active === undefined
          ? undefined
          : query.data.active === "true",
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET /api/admin/categories", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las categorías" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission("categories.create");

  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createCategorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { slug, ...rest } = parsed.data;

  try {
    const category = await categoryRepository.create({
      ...rest,
      slug: slug ?? slugify(rest.name),
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 },
      );
    }

    console.error("POST /api/admin/categories", error);
    return NextResponse.json(
      { error: "No se pudo crear la categoría" },
      { status: 500 },
    );
  }
}
