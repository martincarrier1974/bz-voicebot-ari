import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getRuntimeConfigPathForTenant } from "@/lib/tenant";
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

function sortFlowsForRuntime<T extends { name: string; destinationPost: string }>(flows: T[]) {
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

async function getSettingValue(tenantId: string, key: string) {
  return prisma.setting.findFirst({ where: { tenantId, key } });
}

export async function buildRuntimeConfig(tenantId: string): Promise<PublishedVoicebotConfig> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error("Client introuvable pour publication runtime.");
  }

  const [prompts, contexts, routes, settings, flows, directoryContacts, bookingServices, calendarConnections, calendarResources] = await Promise.all([
    prisma.prompt.findMany({ where: { tenantId, isActive: true }, orderBy: { scenario: "asc" } }),
    prisma.context.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.routeRule.findMany({ where: { tenantId, isActive: true }, orderBy: { priority: "asc" } }),
    prisma.setting.findMany({ where: { tenantId } }),
    prisma.flow.findMany({
      where: { tenantId, isActive: true },
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
    prisma.directoryContact.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.bookingService.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.calendarConnection.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.calendarResource.findMany({
      where: { tenantId, isActive: true },
      include: {
        connection: true,
        services: {
          where: { isActive: true },
          include: { bookingService: true },
          orderBy: { priority: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
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
    companyName: settingsMap.company_name ?? tenant.name,
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
    bookingServices: bookingServices.map((service) => ({
      name: service.name,
      slug: service.slug,
      description: service.description,
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
    })),
    calendarConnections: calendarConnections.map((connection) => ({
      name: connection.name,
      provider: connection.provider,
      tenantId: connection.tenantExternalId,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      refreshToken: connection.refreshToken,
      accountEmail: connection.accountEmail,
      defaultCalendarId: connection.defaultCalendarId,
      timezone: connection.timezone,
    })),
    calendarResources: calendarResources.map((resource) => ({
      name: resource.name,
      employeeName: resource.employeeName,
      calendarId: resource.calendarId,
      calendarAddress: resource.calendarAddress,
      timezone: resource.timezone,
      bookingNotes: resource.bookingNotes,
      connectionName: resource.connection.name,
      provider: resource.connection.provider,
      supportedServices: resource.services.map((service) => ({
        serviceSlug: service.bookingService.slug,
        serviceName: service.bookingService.name,
        priority: service.priority,
      })),
    })),
  };
}

export async function publishRuntimeConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error("Client introuvable pour publication runtime.");
  }

  const config = await buildRuntimeConfig(tenantId);
  const runtimeRelativePath = getRuntimeConfigPathForTenant(tenant);
  const runtimePath = path.resolve(process.cwd(), "..", "..", runtimeRelativePath);
  const runtimeDir = path.dirname(runtimePath);

  await mkdir(runtimeDir, { recursive: true });
  await writeFile(runtimePath, JSON.stringify(config, null, 2), "utf8");

  for (const [key, label, value] of [
    ["runtime_last_published_at", "Dernière publication runtime", config.generatedAt],
    ["runtime_last_published_path", "Chemin runtime publié", runtimePath],
  ] as const) {
    const existing = await getSettingValue(tenantId, key);
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { label, value } });
    } else {
      await prisma.setting.create({ data: { tenantId, key, label, value } });
    }
  }

  if (!tenant.runtimeConfigPath || tenant.runtimeConfigPath !== runtimeRelativePath) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { runtimeConfigPath: runtimeRelativePath } });
  }

  return { runtimePath, generatedAt: config.generatedAt };
}
