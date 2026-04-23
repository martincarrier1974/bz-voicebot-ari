import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma ne charge pas automatiquement le `.env` racine lorsque `prisma.config.ts` est utilisé.
// On charge donc explicitement le `.env` du repo (fallback) pour les déploiements serveur.
dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
