import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { createSetupSession } from "@/server/services/payment-method.service";

// Sin Zod: no recibe body. La única entrada es el usuario de la sesión.
export async function POST() {
  const guard = await requireSessionUser();

  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ url: await createSetupSession(guard.user) });
  } catch (error) {
    console.error("POST /api/payment-methods/setup-session", error);
    return NextResponse.json(
      { error: "No se pudo iniciar el alta de la tarjeta" },
      { status: 500 },
    );
  }
}
