import { NextResponse, type NextRequest } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { addToCartSchema } from "@/modules/cart/schemas/cart.schema";
import * as cartRepository from "@/server/repositories/cart.repository";
import * as productRepository from "@/server/repositories/product.repository";

export async function GET() {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await cartRepository.listByUser(guard.user.id));
  } catch (error) {
    console.error("GET /api/cart", error);
    return NextResponse.json(
      { error: "No se pudo obtener el carrito" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = addToCartSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { productId, quantity } = parsed.data;

  try {
    const product = await productRepository.findById(productId);

    // Un producto dado de baja no existe para el storefront (mismo criterio que
    // `listPublic`): 404, no 403.
    if (!product || !product.isActive) {
      return NextResponse.json(
        { error: "El producto no existe" },
        { status: 404 },
      );
    }

    // Se valida el stock, no se reserva: entre esta lectura y el checkout puede
    // cambiar. El bloqueo real es problema del spec de `orders`.
    if (product.stock <= 0) {
      return NextResponse.json(
        { error: "El producto no tiene stock" },
        { status: 409 },
      );
    }

    await cartRepository.addItem(guard.user.id, productId, quantity);

    return NextResponse.json(await cartRepository.listByUser(guard.user.id));
  } catch (error) {
    console.error("POST /api/cart", error);
    return NextResponse.json(
      { error: "No se pudo agregar el producto al carrito" },
      { status: 500 },
    );
  }
}
