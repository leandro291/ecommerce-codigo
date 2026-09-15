import { NextResponse, type NextRequest } from "next/server";

import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db-errors";
import { requirePermission } from "@/lib/permissions";
import {
  categoryIdSchema,
  updateCategorySchema,
} from "@/modules/categories/schemas/category.schema";
import * as categoryRepository from "@/server/repositories/category.repository";

type Ctx = RouteContext<"/api/admin/categories/[id]">;

// Un Response no se puede reutilizar entre requests: se construye uno por llamada.
const notFound = () =>
  NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });

async function resolveId(ctx: Ctx) {
  const { id } = await ctx.params;
  return categoryIdSchema.safeParse(id);
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("categories.read");

  if (!guard.ok) return guard.response;

  const id = await resolveId(ctx);

  if (!id.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: id.error.issues },
      { status: 400 },
    );
  }

  try {
    const category = await categoryRepository.findById(id.data);

    if (!category) return notFound();

    return NextResponse.json(category);
  } catch (error) {
    console.error("GET /api/admin/categories/[id]", error);
    return NextResponse.json(
      { error: "No se pudo obtener la categoría" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("categories.update");

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

  const parsed = updateCategorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const category = await categoryRepository.update(id.data, parsed.data);

    if (!category) return notFound();

    return NextResponse.json(category);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese slug" },
        { status: 409 },
      );
    }

    console.error("PATCH /api/admin/categories/[id]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la categoría" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("categories.delete");

  if (!guard.ok) return guard.response;

  const id = await resolveId(ctx);

  if (!id.success) {
    return NextResponse.json(
      { error: "Identificador inválido", issues: id.error.issues },
      { status: 400 },
    );
  }

  try {
    const category = await categoryRepository.remove(id.data);

    if (!category) return notFound();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: "La categoría tiene productos asociados" },
        { status: 409 },
      );
    }

    console.error("DELETE /api/admin/categories/[id]", error);
    return NextResponse.json(
      { error: "No se pudo borrar la categoría" },
      { status: 500 },
    );
  }
}
