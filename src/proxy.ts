import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/products(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/products(.*)",
  "/api/categories(.*)",
  "/api/webhooks(.*)",
]);

// Separados a propósito: las páginas se cortan con redirect, la API con JSON.
const isAdminPage = createRouteMatcher(["/admin(.*)"]);
const isJsonApi = createRouteMatcher([
  "/api/admin(.*)",
  "/api/cart(.*)",
  "/api/checkout(.*)",
  "/api/orders(.*)",
  "/api/payment-methods(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // La API autenticada no pasa por el borde: `auth.protect()` responde
  // `notFound()` (404 HTML) y un redirect devolvería 307 a una página. Su
  // contrato es JSON y lo cumplen los guards de cada handler:
  // `requirePermission` en admin (401/403) y `requireSessionUser` en cart (401).
  if (isJsonApi(request)) return;

  // Corte optimista de páginas: el claim puede estar viejo (token ~60 s) o
  // ausente (paso manual del dashboard sin hacer), así que solo `false` corta.
  // La verdad la da la BD en el layout (docs/SETUP.md §6, CLAUDE.md regla 8).
  if (isAdminPage(request)) {
    const { sessionClaims } = await auth.protect();

    if (sessionClaims?.metadata?.panel === false) {
      return NextResponse.redirect(new URL("/sin-acceso", request.url));
    }

    return;
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
