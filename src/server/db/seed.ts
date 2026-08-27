import { config } from "dotenv";

config({ path: ".env.local" });

async function seed() {
  console.log("seed: sin datos que insertar todavía");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
