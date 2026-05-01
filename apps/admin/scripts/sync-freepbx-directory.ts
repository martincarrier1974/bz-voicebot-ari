import { publishRuntimeConfig } from "../src/lib/runtime-config";
import { syncFreepbxDirectory } from "../src/lib/freepbx-directory";
import { prisma } from "../src/lib/prisma";

function getTenantIdArg() {
  const explicit = process.argv.find((arg) => arg.startsWith("--tenant="));
  return explicit ? explicit.slice("--tenant=".length).trim() : "";
}

async function main() {
  const tenantId = getTenantIdArg() || (await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }))?.id;

  if (!tenantId) {
    throw new Error("Aucun client actif disponible pour la synchronisation FreePBX.");
  }

  const result = await syncFreepbxDirectory(tenantId);
  const publish = process.argv.includes("--publish");
  let runtime = null;

  if (publish) {
    runtime = await publishRuntimeConfig(tenantId);
  }

  console.log(
    JSON.stringify(
      {
        tenantId,
        syncedAt: result.syncedAt,
        count: result.count,
        published: runtime,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
