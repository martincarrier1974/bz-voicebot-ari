import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFreepbxApiConfig, isFreepbxApiConfigured } from "@/lib/freepbx-api";

type PrismaTransaction = Prisma.TransactionClient;

export type FreepbxDirectoryEntry = {
  extension: string;
  name: string;
  aliases: string[];
  voicemail: string | null;
  tech: string | null;
  source: "coreUser" | "extension" | "merged";
};

type TokenResponse = {
  access_token: string;
};

type CoreUserRecord = {
  extension?: string | null;
  name?: string | null;
  voicemail?: string | null;
};

type ExtensionRecord = {
  extensionId?: string | null;
  tech?: string | null;
  user?: CoreUserRecord | null;
};

const CORE_USERS_QUERY = `
  query FreepbxCoreUsers {
    allCoreUsers {
      coreUser {
        extension
        name
        voicemail
      }
    }
  }
`;

const EXTENSIONS_QUERY = `
  query FreepbxExtensions {
    fetchAllExtensions {
      extension {
        extensionId
        tech
        user {
          extension
          name
          voicemail
        }
      }
    }
  }
`;

function normalizeName(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeExtension(value: string | null | undefined) {
  return String(value || "").trim();
}

function buildAliases(name: string) {
  const source = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, " ")
    .toLowerCase();

  const chunks = source
    .split(/[^a-z0-9]+/gi)
    .map((item) => item.trim())
    .filter(Boolean);

  const aliases = new Set<string>();
  if (name.trim()) aliases.add(name.trim());
  if (source.trim()) aliases.add(source.trim().replace(/\s+/g, " "));

  for (const chunk of chunks) {
    if (chunk.length >= 2) aliases.add(chunk);
  }

  if (chunks.length >= 2) {
    aliases.add(`${chunks[0]} ${chunks[chunks.length - 1]}`);
  }

  return [...aliases];
}

async function getAccessToken(tenantId: string) {
  const config = await getFreepbxApiConfig(tenantId);
  if (!isFreepbxApiConfigured(config)) {
    throw new Error("La configuration API FreePBX est incomplète.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Échec OAuth FreePBX (${response.status})`);
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token) {
    throw new Error("Réponse OAuth FreePBX invalide : access_token manquant.");
  }

  return { config, accessToken: payload.access_token };
}

async function freepbxGraphql<T>(tenantId: string, query: string): Promise<T> {
  const { config, accessToken } = await getAccessToken(tenantId);
  const response = await fetch(config.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Échec GraphQL FreePBX (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    const meaningfulErrors = payload.errors
      .map((error) => error.message || "Erreur inconnue")
      .filter((message) => !/internal server error/i.test(message));

    if (meaningfulErrors.length > 0) {
      throw new Error(`Erreur GraphQL FreePBX : ${meaningfulErrors.join(" | ")}`);
    }
  }

  if (!payload.data) {
    throw new Error("Réponse GraphQL FreePBX vide.");
  }

  return payload.data;
}

function mergeDirectoryEntries(coreUsers: CoreUserRecord[], extensions: ExtensionRecord[]): FreepbxDirectoryEntry[] {
  const merged = new Map<string, FreepbxDirectoryEntry>();

  for (const user of coreUsers) {
    const extension = normalizeExtension(user.extension);
    const name = normalizeName(user.name);
    if (!extension || !name) continue;

    merged.set(extension, {
      extension,
      name,
      aliases: buildAliases(name),
      voicemail: user.voicemail?.trim() || null,
      tech: null,
      source: "coreUser",
    });
  }

  for (const extensionRow of extensions) {
    const extension = normalizeExtension(extensionRow.extensionId || extensionRow.user?.extension);
    const name = normalizeName(extensionRow.user?.name);
    if (!extension || !name) continue;

    const existing = merged.get(extension);
    merged.set(extension, {
      extension,
      name,
      aliases: buildAliases(name),
      voicemail: extensionRow.user?.voicemail?.trim() || existing?.voicemail || null,
      tech: extensionRow.tech?.trim() || existing?.tech || null,
      source: existing ? "merged" : "extension",
    });
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

export async function fetchFreepbxDirectory(tenantId: string) {
  const [coreUsersData, extensionsData] = await Promise.all([
    freepbxGraphql<{ allCoreUsers?: { coreUser?: CoreUserRecord[] | null } | null }>(tenantId, CORE_USERS_QUERY),
    freepbxGraphql<{ fetchAllExtensions?: { extension?: ExtensionRecord[] | null } | null }>(tenantId, EXTENSIONS_QUERY),
  ]);

  const coreUsers = coreUsersData.allCoreUsers?.coreUser ?? [];
  const extensions = extensionsData.fetchAllExtensions?.extension ?? [];

  return mergeDirectoryEntries(coreUsers, extensions);
}

export async function syncFreepbxDirectory(tenantId: string) {
  const config = await getFreepbxApiConfig(tenantId);
  if (!isFreepbxApiConfigured(config)) {
    throw new Error("La configuration API FreePBX est incomplète.");
  }

  const entries = await fetchFreepbxDirectory(tenantId);
  const nowIso = new Date().toISOString();
  const activeExtensions = new Set(entries.map((entry) => entry.extension));

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    for (const entry of entries) {
      const existing = await tx.directoryContact.findFirst({ where: { tenantId, extension: entry.extension } });
      if (existing) {
        await tx.directoryContact.update({
          where: { id: existing.id },
          data: {
            name: entry.name,
            aliases: entry.aliases.join(", "),
            voicemail: entry.voicemail,
            tech: entry.tech,
            source: entry.source,
            isActive: true,
            lastSyncedAt: new Date(nowIso),
          },
        });
      } else {
        await tx.directoryContact.create({
          data: {
            tenantId,
            extension: entry.extension,
            name: entry.name,
            aliases: entry.aliases.join(", "),
            voicemail: entry.voicemail,
            tech: entry.tech,
            source: entry.source,
            isActive: true,
            lastSyncedAt: new Date(nowIso),
          },
        });
      }
    }

    await tx.directoryContact.updateMany({
      where: {
        tenantId,
        extension: { notIn: [...activeExtensions] },
      },
      data: {
        isActive: false,
        lastSyncedAt: new Date(nowIso),
      },
    });

    for (const [key, label, value] of [
      ["freepbx_directory_last_synced_at", "Dernière sync annuaire FreePBX", nowIso],
      ["freepbx_directory_last_synced_count", "Dernier volume importé", String(entries.length)],
    ] as const) {
      const existingSetting = await tx.setting.findFirst({ where: { tenantId, key } });
      if (existingSetting) {
        await tx.setting.update({ where: { id: existingSetting.id }, data: { label, value } });
      } else {
        await tx.setting.create({ data: { tenantId, key, label, value } });
      }
    }
  });

  return { count: entries.length, syncedAt: nowIso };
}
