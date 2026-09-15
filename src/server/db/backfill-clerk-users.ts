import { config } from "dotenv";

// Antes de cualquier import de `db` o de Clerk: ambos leen el entorno al
// evaluarse. Por eso los módulos de abajo entran por import dinámico.
config({ path: ".env.local" });

const PAGE_SIZE = 100;

// Importa a `users` los usuarios que ya existen en Clerk (los que se registraron
// antes de que hubiera webhook, o los que se perdieron por una entrega fallida).
// Idempotente: una segunda corrida reporta 0 creados.
async function backfill() {
  const { clerkClient } = await import("@clerk/nextjs/server");
  const { upsertUserFromClerk, syncClerkPublicMetadata } = await import(
    "@/lib/clerk-sync"
  );

  const client = await clerkClient();
  const summary = { created: 0, updated: 0, skipped: 0 };

  let offset = 0;
  let totalCount = 0;

  do {
    const page = await client.users.getUserList({ limit: PAGE_SIZE, offset });

    totalCount = page.totalCount;

    if (page.data.length === 0) break;

    for (const user of page.data) {
      const email =
        user.emailAddresses.find(
          (address) => address.id === user.primaryEmailAddressId,
        )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

      if (!email) {
        summary.skipped += 1;
        console.warn(`backfill: ${user.id} no tiene email; se omite`);
        continue;
      }

      const { created } = await upsertUserFromClerk(
        {
          clerkId: user.id,
          email,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        },
        { svixId: null },
      );

      if (created) summary.created += 1;
      else summary.updated += 1;

      // Se sincroniza a todos, no solo a los del panel: si no, el super_admin
      // sembrado a mano se quedaría sin `panel: true` antes de la fase 3.
      // ponytail: una llamada a Clerk por usuario (límite dev: 100 req/10 s).
      // Espaciar con un sleep si el padrón pasa de unos cientos.
      await syncClerkPublicMetadata(user.id);
    }

    offset += page.data.length;
  } while (offset < totalCount);

  console.log(
    `backfill: ${totalCount} usuarios en Clerk — ${summary.created} creados, ${summary.updated} actualizados, ${summary.skipped} sin email`,
  );
}

backfill().catch((error) => {
  console.error(error);
  process.exit(1);
});
