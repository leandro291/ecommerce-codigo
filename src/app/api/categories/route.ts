import { NextResponse } from "next/server";

import * as categoryRepository from "@/server/repositories/category.repository";

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

// Sin parámetros: no hay entrada que validar. El repositorio ya ordena por
// `position` y el filtro de activas es fijo, no viene del cliente.
export async function GET() {
  try {
    const categories = await categoryRepository.list({ isActive: true });

    return NextResponse.json(categories, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    console.error("GET /api/categories", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las categorías" },
      { status: 500 },
    );
  }
}
