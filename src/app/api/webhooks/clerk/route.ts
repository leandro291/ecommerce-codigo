import {
  verifyWebhook,
  type UserWebhookEvent,
  type WebhookEvent,
} from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

import {
  deactivateUserFromClerk,
  syncClerkPublicMetadata,
  upsertUserFromClerk,
} from "@/lib/clerk-sync";

// Una respuesta nueva por llamada: un `Response` module-scope se reusaría entre
// requests con el body ya consumido.
const ok = () => NextResponse.json({ ok: true });

// Derivado de la unión de Clerk en vez de importar `UserJSON` de
// `@clerk/backend`, que es una dependencia transitiva.
type ClerkUserData = Extract<
  UserWebhookEvent,
  { type: "user.created" | "user.updated" }
>["data"];

function primaryEmail(data: ClerkUserData): string | undefined {
  const primary = data.email_addresses.find(
    (address) => address.id === data.primary_email_address_id,
  );

  return primary?.email_address ?? data.email_addresses[0]?.email_address;
}

export async function POST(request: NextRequest) {
  // Verificación criptográfica en vez de Zod: garantiza que el cuerpo lo firmó
  // Clerk y devuelve la unión discriminada `WebhookEvent` (spec 005 §6).
  let event: WebhookEvent;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("clerk-webhook: firma inválida", error);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const svixId = request.headers.get("svix-id");

  // Todo lo que sigue responde 200 salvo error de BD: Svix reintenta ante 4xx y
  // 5xx, y un payload inservible no mejora con reintentos.
  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const email = primaryEmail(event.data);

      if (!email) {
        console.warn(
          `clerk-webhook: ${event.type} sin email para ${event.data.id}; se ignora`,
        );
        return ok();
      }

      const { created, assignedDefaultRole } = await upsertUserFromClerk(
        {
          clerkId: event.data.id,
          email,
          firstName: event.data.first_name,
          lastName: event.data.last_name,
          imageUrl: event.data.image_url,
        },
        { svixId },
      );

      // Escribir publicMetadata dispara otro `user.updated`: sin esta condición
      // el rebote entra en bucle infinito (spec 005 §10).
      if (created || assignedDefaultRole) {
        try {
          await syncClerkPublicMetadata(event.data.id);
        } catch (error) {
          // La base ya quedó bien; el metadata es cache derivado y lo repara
          // `npm run sync:clerk-users`.
          console.error(
            `clerk-webhook: no se pudo escribir publicMetadata de ${event.data.id}`,
            error,
          );
        }
      }

      return ok();
    }

    case "user.deleted": {
      // `id` es opcional en `UserDeletedJSON`.
      const clerkId = event.data.id;

      if (!clerkId) {
        console.warn("clerk-webhook: user.deleted sin id; se ignora");
        return ok();
      }

      await deactivateUserFromClerk(clerkId, { svixId });

      return ok();
    }

    default:
      return ok();
  }
}
