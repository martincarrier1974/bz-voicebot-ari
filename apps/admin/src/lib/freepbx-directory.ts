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

async function getAccessToken() {
  const config = await getFreepbxApiConfig();
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

async function freepbxGraphql<T>(query: string): Promise<T> {
  const { config, accessToken } = await getAccessToken();
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

export async function fetchFreepbxDirectory() {
  const [coreUsersData, extensionsData] = await Promise.all([
    freepbxGraphql<{ allCoreUsers?: { coreUser?: CoreUserRecord[] | null } | null }>(CORE_USERS_QUERY),
    freepbxGraphql<{ fetchAllExtensions?: { extension?: ExtensionRecord[] | null } | null }>(EXTENSIONS_QUERY),
  ]);

  const coreUsers = coreUsersData.allCoreUsers?.coreUser ?? [];
  const extensions = extensionsData.fetchAllExtensions?.extension ?? [];

  return mergeDirectoryEntries(coreUsers, extensions);
}

export async function syncFreepbxDirectory() {
  const config = await getFreepbxApiConfig();
  if (!isFreepbxApiConfigured(config)) {
    throw new Error("La configuration API FreePBX est incomplète.");
  }

  const entries = await fetchFreepbxDirectory();
  const nowIso = new Date().toISOString();
  const activeExtensions = new Set(entries.map((entry) => entry.extension));

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    for (const entry of entries) {
      await tx.directoryContact.upsert({
        where: { extension: entry.extension },
        update: {
          name: entry.name,
          aliases: entry.aliases.join(", "),
          voicemail: entry.voicemail,
          tech: entry.tech,
          source: entry.source,
          isActive: true,
          lastSyncedAt: new Date(nowIso),
        },
        create: {
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

    await tx.directoryContact.updateMany({
      where: {
        extension: {
          notIn: [...activeExtensions],
        },
      },
      data: {
        isActive: false,
        lastSyncedAt: new Date(nowIso),
      },
    });

    await tx.setting.upsert({
      where: { key: "freepbx_directory_last_synced_at" },
      update: { label: "Dernière sync annuaire FreePBX", value: nowIso },
      create: { key: "freepbx_directory_last_synced_at", label: "Dernière sync annuaire FreePBX", value: nowIso },
    });

    await tx.setting.upsert({
      where: { key: "freepbx_directory_last_synced_count" },
      update: { label: "Nombre de contacts importés FreePBX", value: String(entries.length) },
      create: { key: "freepbx_directory_last_synced_count", label: "Nombre de contacts importés FreePBX", value: String(entries.length) },
    });
  });

  return {
    syncedAt: nowIso,
    count: entries.length,
    entries,
  };
}

export async function testFreepbxConnection() {
  const config = await getFreepbxApiConfig();
  return {
    configured: isFreepbxApiConfigured(config),
    graphqlUrl: config.graphqlUrl,
    tokenUrl: config.tokenUrl,
    directoryPreview: await fetchFreepbxDirectory(),
  };
}
