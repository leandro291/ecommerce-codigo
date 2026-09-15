import { NextResponse, type NextRequest } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
  productIdSchema,
  setQuantitySchema,
} from "@/modules/cart/schemas/cart.schema";
import * as cartRepository from "@/server/repositories/cart.repository";
import * as productRepository from "@/server/repositories/product.repository";

type Ctx = RouteContext<"/api/cart/[productId]">;

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  const parsedId = productIdSchema.safeParse((await ctx.params).productId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = setQuantitySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // El tope depende de una fila de `products`, así que Zod (que solo ve el
    // payload) no puede cubrirlo: el `max` del stepper es UX, este 409 es la
    // regla. Se valida el stock, no se reserva — igual que el POST.
    const product = await productRepository.findById(parsedId.data);

    if (product) {
      if (product.stock <= 0) {
        return NextResponse.json(
          { error: "El producto no tiene stock" },
          { status: 409 },
        );
      }

      if (parsed.data.quantity > product.stock) {
        const unidades = product.stock === 1 ? "unidad" : "unidades";

        return NextResponse.json(
          { error: `Solo quedan ${product.stock} ${unidades} disponibles` },
          { status: 409 },
        );
      }
    }

    const updated = await cartRepository.setQuantity(
      guard.user.id,
      parsedId.data,
      parsed.data.quantity,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "El producto no está en tu carrito" },
        { status: 404 },
      );
    }

    return NextResponse.json(await cartRepository.listByUser(guard.user.id));
  } catch (error) {
    console.error("PATCH /api/cart/[productId]", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la cantidad" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  const parsedId = productIdSchema.safeParse((await ctx.params).productId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  }

  try {
    const removed = await cartRepository.removeItem(
      guard.user.id,
      parsedId.data,
    );

    if (!removed) {
      return NextResponse.json(
        { error: "El producto no está en tu carrito" },
        { status: 404 },
      );
    }

    return NextResponse.json(await cartRepository.listByUser(guard.user.id));
  } catch (error) {
    console.error("DELETE /api/cart/[productId]", error);
    return NextResponse.json(
      { error: "No se pudo quitar el producto" },
      { status: 500 },
    );
  }
}
