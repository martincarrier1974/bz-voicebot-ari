import { publishRuntimeConfig } from "../src/lib/runtime-config";
import { syncFreepbxDirectory } from "../src/lib/freepbx-directory";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await syncFreepbxDirectory();
  const publish = process.argv.includes("--publish");
  let runtime = null;

  if (publish) {
    runtime = await publishRuntimeConfig();
  }

  console.log(
    JSON.stringify(
      {
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
