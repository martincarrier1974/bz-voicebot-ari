import * as BetterSqlite3Adapter from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import type { PrismaClientOptions } from "@prisma/client/runtime/library";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const AdapterCtor =
  // Prisma 7 docs suggest PrismaBetterSQLite3, but some versions export PrismaBetterSqlite3.
  (BetterSqlite3Adapter as unknown as { PrismaBetterSqlite3?: new (args: { url: string }) => unknown }).PrismaBetterSqlite3 ??
  (BetterSqlite3Adapter as unknown as { PrismaBetterSQLite3?: new (args: { url: string }) => unknown }).PrismaBetterSQLite3;

if (!AdapterCtor) {
  throw new Error(
    "Adapter @prisma/adapter-better-sqlite3 export not found. Expected PrismaBetterSqlite3 or PrismaBetterSQLite3."
  );
}

const adapter = new AdapterCtor({
  url: process.env.DATABASE_URL || "file:./dev.db",
}) as unknown as PrismaClientOptions["adapter"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
