import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.promptVersion.deleteMany();
  await prisma.flowIntent.deleteMany();
  await prisma.flow.deleteMany();
  await prisma.routeRule.deleteMany();
  await prisma.context.deleteMany();
  await prisma.prompt.deleteMany();
  await prisma.setting.deleteMany();

  const prompts = [
    {
      key: "main_agent_prompt",
      name: "Prompt principal",
      scenario: "main",
      description: "Prompt principal de l'agent vocal",
      content:
        "Tu es l'agent téléphonique IA de BZ Telecom. Réponds en français québécois naturel, avec des phrases courtes, humaines et fluides, puis dirige rapidement l'appel vers le bon service.",
    },
    {
      key: "greeting",
      name: "Prompt accueil",
      scenario: "accueil",
      description: "Message d'accueil principal",
      content: "Bonjour, vous êtes chez BZ Telecom. Qu'est-ce que je peux faire pour vous aujourd'hui ?",
    },
    {
      key: "silence_retry",
      name: "Prompt relance silence",
      scenario: "silence",
      description: "Relance si l'appelant ne répond pas",
      content: "Je suis là. Est-ce que c'est pour le soutien technique, les ventes ou la réception ?",
    },
    {
      key: "clarification",
      name: "Prompt clarification",
      scenario: "clarification",
      description: "Clarification si la demande est ambiguë",
      content:
        "Je peux vous aider à diriger votre appel. Est-ce que c'est pour le soutien technique, les ventes ou la réception ?",
    },
    {
      key: "transfer_support",
      name: "Transfert support",
      scenario: "transfert_support",
      description: "Confirmation avant transfert support",
      content: "Parfait, je vous transfère au soutien technique.",
    },
    {
      key: "transfer_sales",
      name: "Transfert ventes",
      scenario: "transfert_ventes",
      description: "Confirmation avant transfert ventes",
      content: "D'accord, je vous transfère aux ventes.",
    },
    {
      key: "transfer_reception",
      name: "Transfert réception",
      scenario: "transfert_reception",
      description: "Confirmation avant transfert réception",
      content: "Je vais vous transférer à la réception.",
    },
    {
      key: "fallback_other",
      name: "Fallback / autre",
      scenario: "fallback",
      description: "Réponse si l'intention n'est pas reconnue",
      content: "Je vais vous transférer à la réception pour qu'on puisse mieux vous aider.",
    },
  ];

  for (const prompt of prompts) {
    const created = await prisma.prompt.create({ data: prompt });
    await prisma.promptVersion.create({
      data: {
        promptId: created.id,
        content: created.content,
        note: "Version initiale",
      },
    });
  }

  const context = await prisma.context.create({
    data: {
      name: "Standard téléphonique BZ",
      description: "Contexte général du standard téléphonique",
      instructions: "Accueillir de façon naturelle, comprendre l'intention, clarifier si nécessaire, puis transférer rapidement sans allonger la conversation.",
      voiceTone: "Professionnel, chaleureux, québécois, naturel, pas robotique",
      rules: "Une question à la fois. Toujours annoncer brièvement le transfert. Après 2 échecs, envoyer à la réception. Ne pas ajouter de phrase inutile après le transfert.",
      limits: "Ne pas faire de dépannage détaillé. Ne pas improviser des informations sensibles.",
      responseExamples:
        "Parfait, je vous transfère au soutien technique. | D'accord, je vous transfère aux ventes. | Je vais vous transférer à la réception.",
    },
  });

  const support = await prisma.routeRule.create({
    data: {
      serviceName: "Support technique",
      extension: "101",
      keywords: "internet,panne,support,technique,problème,téléphone",
      priority: 10,
    },
  });

  const sales = await prisma.routeRule.create({
    data: {
      serviceName: "Ventes / Soumission",
      extension: "102",
      keywords: "vente,prix,soumission,forfait,achat,service",
      priority: 20,
    },
  });

  const reception = await prisma.routeRule.create({
    data: {
      serviceName: "Réception / Autres",
      extension: "105",
      keywords: "réception,autre,administration,général",
      priority: 99,
    },
  });

  const flow = await prisma.flow.create({
    data: {
      name: "Flow principal BZ Telecom",
      welcomeMessage: "Bonjour, vous êtes chez BZ Telecom. Qu'est-ce que je peux faire pour vous aujourd'hui ?",
      silencePrompt: "Je suis là. Quelle est la raison de votre appel ?",
      ambiguousPrompt:
        "Je peux vous aider à diriger votre appel. Est-ce que c'est pour le soutien technique, les ventes ou la réception ?",
      fallbackPrompt: "Je vais vous transférer à la réception pour qu'on puisse mieux vous aider.",
      finalAction: "transfer",
      destinationLabel: "Réception / Autres",
      destinationPost: "105",
      maxFailedAttempts: 2,
      contextId: context.id,
    },
  });

  await prisma.flowIntent.createMany({
    data: [
      {
        flowId: flow.id,
        routeRuleId: support.id,
        label: "Soutien technique / support",
        keywords: support.keywords,
        response: "Parfait, je vous transfère au soutien technique.",
        finalAction: "transfer",
        destinationPost: "101",
        priority: 10,
      },
      {
        flowId: flow.id,
        routeRuleId: sales.id,
        label: "Ventes / soumission",
        keywords: sales.keywords,
        response: "D'accord, je vous transfère aux ventes.",
        finalAction: "transfer",
        destinationPost: "102",
        priority: 20,
      },
      {
        flowId: flow.id,
        routeRuleId: reception.id,
        label: "Réception / autres",
        keywords: reception.keywords,
        response: "Je vais vous transférer à la réception.",
        finalAction: "transfer",
        destinationPost: "105",
        priority: 99,
      },
    ],
  });

  await prisma.setting.createMany({
    data: [
      { key: "company_name", label: "Nom de l'entreprise", value: "BZ Telecom" },
      { key: "default_locale", label: "Langue par défaut", value: "fr-CA" },
      { key: "max_attempts", label: "Nombre maximum d'échecs", value: "2" },
      { key: "default_fallback_extension", label: "Poste fallback", value: "105" },
      { key: "tts_provider", label: "Provider TTS", value: "eleven_labs" },
      { key: "dg_agent_llm_model", label: "Modèle LLM de l'agent", value: "gpt-4o-mini" },
      { key: "dg_tts_model", label: "Modèle TTS Deepgram", value: "aura-2-agathe-fr" },
      { key: "elevenlabs_model_id", label: "Modèle ElevenLabs", value: "eleven_multilingual_v2" },
      { key: "elevenlabs_voice_id", label: "Voice ID ElevenLabs", value: "" },
      { key: "elevenlabs_language", label: "Langue ElevenLabs", value: "multi" },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
