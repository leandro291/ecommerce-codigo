import { NextResponse, type NextRequest } from "next/server";

import { publicProductQuerySchema } from "@/modules/products/schemas/product.schema";
import * as productRepository from "@/server/repositories/product.repository";

// Catálogo público: mismo cuerpo para todo visitante, así que se cachea en el
// borde. Sin `auth()` de por medio, nada acá depende de la sesión.
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
  const parsed = publicProductQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const products = await productRepository.listPublic(parsed.data);

    return NextResponse.json(products, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los productos" },
      { status: 500 },
    );
  }
}
