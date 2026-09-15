import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { createCheckoutSession } from "@/server/services/checkout.service";

// Sin Zod: no recibe body. El carrito vive en el servidor y es la única entrada.
export async function POST() {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  try {
    const result = await createCheckoutSession(guard.user);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("POST /api/checkout", error);
    return NextResponse.json(
      { error: "No se pudo iniciar el pago" },
      { status: 500 },
    );
  }
}
