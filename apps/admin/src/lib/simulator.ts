import type { Flow, FlowIntent, Prompt, RouteRule } from "@prisma/client";

type FlowWithRelations = Flow & {
  intents: (FlowIntent & { routeRule: RouteRule | null })[];
};

export type SimulationResult = {
  utterance: string;
  matchedIntent: string;
  matchedRoute: string;
  promptUsed: string;
  response: string;
  destination: string;
  path: string[];
};

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function splitKeywords(text: string) {
  return text
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function simulateFlow({
  utterance,
  attempt,
  flow,
  prompts,
  routes,
}: {
  utterance: string;
  attempt: number;
  flow: FlowWithRelations;
  prompts: Prompt[];
  routes: RouteRule[];
}): SimulationResult {
  const normalizedUtterance = normalize(utterance);
  const path = ["accueil"];

  const promptByScenario = new Map(prompts.map((prompt) => [prompt.scenario, prompt]));
  const clarificationPrompt =
    promptByScenario.get("clarification")?.content ?? flow.ambiguousPrompt;
  const silencePrompt = promptByScenario.get("silence")?.content ?? flow.silencePrompt;
  const fallbackPrompt =
    promptByScenario.get("fallback")?.content ?? flow.fallbackPrompt;

  if (!normalizedUtterance.trim()) {
    return {
      utterance,
      matchedIntent: "silence",
      matchedRoute: attempt >= flow.maxFailedAttempts ? "Réception / Autres" : "Aucune",
      promptUsed: silencePrompt,
      response: attempt >= flow.maxFailedAttempts ? fallbackPrompt : silencePrompt,
      destination: attempt >= flow.maxFailedAttempts ? "Poste 105" : "Aucune",
      path: [...path, "silence", attempt >= flow.maxFailedAttempts ? "fallback" : "relance"],
    };
  }

  const sortedRoutes = [...routes].sort((a, b) => a.priority - b.priority);
  for (const route of sortedRoutes) {
    const keywords = splitKeywords(route.keywords);
    if (keywords.some((keyword) => normalizedUtterance.includes(normalize(keyword)))) {
      const intent = flow.intents.find(
        (item) =>
          item.isActive &&
          (item.routeRuleId === route.id || splitKeywords(item.keywords).some((keyword) => normalizedUtterance.includes(normalize(keyword))))
      );

      const scenario =
        route.extension === "101"
          ? "transfert_support"
          : route.extension === "102"
            ? "transfert_ventes"
            : "transfert_reception";

      const promptUsed = promptByScenario.get(scenario)?.content ?? intent?.response ?? flow.welcomeMessage;
      return {
        utterance,
        matchedIntent: intent?.label ?? route.serviceName,
        matchedRoute: route.serviceName,
        promptUsed,
        response: intent?.response ?? promptUsed,
        destination: `Poste ${intent?.destinationPost ?? route.extension}`,
        path: [...path, "intention détectée", route.serviceName, "transfert"],
      };
    }
  }

  if (attempt >= flow.maxFailedAttempts) {
    return {
      utterance,
      matchedIntent: "non reconnue",
      matchedRoute: "Réception / Autres",
      promptUsed: fallbackPrompt,
      response: fallbackPrompt,
      destination: "Poste 105",
      path: [...path, "échec reconnaissance", "fallback", "transfert réception"],
    };
  }

  return {
    utterance,
    matchedIntent: "ambiguë",
    matchedRoute: "Aucune",
    promptUsed: clarificationPrompt,
    response: clarificationPrompt,
    destination: "Aucune",
    path: [...path, "ambiguïté", "clarification"],
  };
}
