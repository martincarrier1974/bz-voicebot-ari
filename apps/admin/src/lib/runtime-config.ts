import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { PublishedVoicebotConfig } from "@/types/voicebot-runtime";

function normalizeKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function sortFlowsForRuntime<T extends { name: string; destinationPost: string; updatedAt?: Date | string }>(flows: T[]) {
  return [...flows].sort((a, b) => {
    const aName = normalizeName(a.name);
    const bName = normalizeName(b.name);

    const aIsPrimary = aName.includes("principal");
    const bIsPrimary = bName.includes("principal");
    if (aIsPrimary !== bIsPrimary) return aIsPrimary ? -1 : 1;

    const aIsReception = a.destinationPost === "105";
    const bIsReception = b.destinationPost === "105";
    if (aIsReception !== bIsReception) return aIsReception ? -1 : 1;

    return aName.localeCompare(bName, "fr");
  });
}

export async function buildRuntimeConfig(): Promise<PublishedVoicebotConfig> {
  const [prompts, contexts, routes, settings, flows, directoryContacts] = await Promise.all([
    prisma.prompt.findMany({ where: { isActive: true }, orderBy: { scenario: "asc" } }),
    prisma.context.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.routeRule.findMany({ where: { isActive: true }, orderBy: { priority: "asc" } }),
    prisma.setting.findMany(),
    prisma.flow.findMany({
      where: { isActive: true },
      include: {
        context: true,
        intents: {
          where: { isActive: true },
          include: { routeRule: true },
          orderBy: { priority: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.directoryContact.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const orderedFlows = sortFlowsForRuntime(flows);

  const settingsMap = Object.fromEntries(
    settings
      .filter((setting) => !setting.key.startsWith("runtime_"))
      .map((setting) => [setting.key, setting.value]),
  );
  const promptMap = Object.fromEntries(prompts.map((prompt) => [prompt.scenario, prompt.content]));
  const primaryFlow = orderedFlows[0] ?? null;
  const primaryContext = primaryFlow?.context ?? contexts[0] ?? null;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    companyName: settingsMap.company_name ?? "BZ Telecom",
    prompts: {
      main: prompts.find((prompt) => prompt.key === "main_agent_prompt")?.content ?? "",
      greeting: promptMap.accueil ?? promptMap.greeting ?? primaryFlow?.welcomeMessage ?? "",
      silence: promptMap.silence ?? primaryFlow?.silencePrompt ?? "",
      clarification: promptMap.clarification ?? primaryFlow?.ambiguousPrompt ?? "",
      fallback: promptMap.fallback ?? primaryFlow?.fallbackPrompt ?? "",
      transferSupport: promptMap.transfert_support ?? "",
      transferSales: promptMap.transfert_ventes ?? "",
      transferReception: promptMap.transfert_reception ?? "",
    },
    settings: settingsMap,
    context: primaryContext
      ? {
          name: primaryContext.name,
          description: primaryContext.description,
          instructions: primaryContext.instructions,
          voiceTone: primaryContext.voiceTone,
          rules: primaryContext.rules,
          limits: primaryContext.limits,
          responseExamples: primaryContext.responseExamples,
        }
      : null,
    routes: routes.map((route) => ({
      serviceName: route.serviceName,
      extension: route.extension,
      priority: route.priority,
      keywords: normalizeKeywords(route.keywords),
    })),
    flows: orderedFlows.map((flow) => ({
      name: flow.name,
      welcomeMessage: flow.welcomeMessage,
      silencePrompt: flow.silencePrompt,
      ambiguousPrompt: flow.ambiguousPrompt,
      fallbackPrompt: flow.fallbackPrompt,
      finalAction: flow.finalAction,
      destinationLabel: flow.destinationLabel,
      destinationPost: flow.destinationPost,
      maxFailedAttempts: flow.maxFailedAttempts,
      contextName: flow.context?.name ?? null,
      intents: flow.intents.map((intent) => ({
        label: intent.label,
        keywords: normalizeKeywords(intent.keywords),
        response: intent.response,
        finalAction: intent.finalAction,
        destinationPost: intent.destinationPost,
        priority: intent.priority,
        routeServiceName: intent.routeRule?.serviceName ?? null,
      })),
    })),
    directoryContacts: directoryContacts.map((contact) => ({
      extension: contact.extension,
      name: contact.name,
      aliases: normalizeKeywords(contact.aliases),
      voicemail: contact.voicemail,
      tech: contact.tech,
    })),
  };
}

export async function publishRuntimeConfig() {
  const config = await buildRuntimeConfig();
  const runtimeDir = path.resolve(process.cwd(), "..", "..", "runtime");
  const runtimePath = path.join(runtimeDir, "voicebot-config.json");

  await mkdir(runtimeDir, { recursive: true });
  await writeFile(runtimePath, JSON.stringify(config, null, 2), "utf8");

  await prisma.setting.upsert({
    where: { key: "runtime_last_published_at" },
    update: {
      label: "Dernière publication runtime",
      value: config.generatedAt,
    },
    create: {
      key: "runtime_last_published_at",
      label: "Dernière publication runtime",
      value: config.generatedAt,
    },
  });

  await prisma.setting.upsert({
    where: { key: "runtime_last_published_path" },
    update: {
      label: "Chemin runtime publié",
      value: runtimePath,
    },
    create: {
      key: "runtime_last_published_path",
      label: "Chemin runtime publié",
      value: runtimePath,
    },
  });

  return { runtimePath, generatedAt: config.generatedAt };
}
