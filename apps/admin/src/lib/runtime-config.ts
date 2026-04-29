import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { PublishedVoicebotConfig } from "@/types/voicebot-runtime";

type PromptRecord = Awaited<ReturnType<typeof prisma.prompt.findMany>>[number];
type SettingRecord = Awaited<ReturnType<typeof prisma.setting.findMany>>[number];
type RouteRecord = Awaited<ReturnType<typeof prisma.routeRule.findMany>>[number];
type DirectoryContactRecord = Awaited<ReturnType<typeof prisma.directoryContact.findMany>>[number];
type BookingServiceRecord = Awaited<ReturnType<typeof prisma.bookingService.findMany>>[number];
type CalendarConnectionRecord = Awaited<ReturnType<typeof prisma.calendarConnection.findMany>>[number];
type CalendarResourceRecord = Awaited<ReturnType<typeof prisma.calendarResource.findMany>>[number];

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
  const [prompts, contexts, routes, settings, flows, directoryContacts, bookingServices, calendarConnections, calendarResources] = await Promise.all([
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
    prisma.bookingService.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.calendarConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.calendarResource.findMany({
      where: { isActive: true },
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

  const orderedFlows = sortFlowsForRuntime<(typeof flows)[number]>(flows);

  const settingsMap = Object.fromEntries(
    settings
      .filter((setting: SettingRecord) => !setting.key.startsWith("runtime_"))
      .map((setting: SettingRecord) => [setting.key, setting.value]),
  );
  const promptMap = Object.fromEntries(prompts.map((prompt: PromptRecord) => [prompt.scenario, prompt.content]));
  const primaryFlow = orderedFlows[0] ?? null;
  const primaryContext = primaryFlow?.context ?? contexts[0] ?? null;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    companyName: settingsMap.company_name ?? "BZ Telecom",
    prompts: {
      main: prompts.find((prompt: PromptRecord) => prompt.key === "main_agent_prompt")?.content ?? "",
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
    routes: routes.map((route: RouteRecord) => ({
      serviceName: route.serviceName,
      extension: route.extension,
      priority: route.priority,
      keywords: normalizeKeywords(route.keywords),
    })),
    flows: orderedFlows.map((flow: (typeof flows)[number]) => ({
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
      intents: flow.intents.map((intent: (typeof flow.intents)[number]) => ({
        label: intent.label,
        keywords: normalizeKeywords(intent.keywords),
        response: intent.response,
        finalAction: intent.finalAction,
        destinationPost: intent.destinationPost,
        priority: intent.priority,
        routeServiceName: intent.routeRule?.serviceName ?? null,
      })),
    })),
    directoryContacts: directoryContacts.map((contact: DirectoryContactRecord) => ({
      extension: contact.extension,
      name: contact.name,
      aliases: normalizeKeywords(contact.aliases),
      voicemail: contact.voicemail,
      tech: contact.tech,
    })),
    bookingServices: bookingServices.map((service: BookingServiceRecord) => ({
      name: service.name,
      slug: service.slug,
      description: service.description,
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
    })),
    calendarConnections: calendarConnections.map((connection: CalendarConnectionRecord) => ({
      name: connection.name,
      provider: connection.provider,
      tenantId: connection.tenantId,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      refreshToken: connection.refreshToken,
      accountEmail: connection.accountEmail,
      defaultCalendarId: connection.defaultCalendarId,
      timezone: connection.timezone,
    })),
    calendarResources: calendarResources.map((resource: CalendarResourceRecord & {
      connection: CalendarConnectionRecord;
      services: Array<{
        priority: number;
        bookingService: BookingServiceRecord;
      }>;
    }) => ({
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
