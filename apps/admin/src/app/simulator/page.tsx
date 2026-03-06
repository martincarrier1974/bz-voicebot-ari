import { AdminShell, Section } from "@/components/admin-shell";
import { Select } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { simulateFlow } from "@/lib/simulator";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ utterance?: string; attempt?: string; flowId?: string }>;
}) {
  await requireAuth();

  const params = await searchParams;
  const flows = await prisma.flow.findMany({
    include: { intents: { include: { routeRule: true } } },
    orderBy: { name: "asc" },
  });
  const prompts = await prisma.prompt.findMany({ where: { isActive: true } });
  const routes = await prisma.routeRule.findMany({ where: { isActive: true } });

  const selectedFlow = flows.find((flow) => flow.id === params.flowId) ?? flows[0];
  const utterance = params.utterance ?? "";
  const attempt = Number(params.attempt ?? "1");

  const result =
    selectedFlow && (utterance || params.attempt)
      ? simulateFlow({ utterance, attempt, flow: selectedFlow, prompts, routes })
      : null;

  return (
    <AdminShell
      title="Simulateur"
      subtitle="Tester un flow sans appeler le système réel et visualiser le chemin logique."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Entrée de simulation" description="Saisir une phrase utilisateur et choisir le flow à tester.">
          <form className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Flow</label>
              <Select
                name="flowId"
                defaultValue={selectedFlow?.id}
                options={flows.map((flow) => ({ value: flow.id, label: flow.name }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phrase utilisateur</label>
              <textarea
                name="utterance"
                rows={5}
                defaultValue={utterance}
                placeholder="Exemple : J'ai un problème avec mon internet."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tentative</label>
              <select
                name="attempt"
                defaultValue={String(attempt)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-sky-500"
              >
                <option value="1">1re tentative</option>
                <option value="2">2e tentative</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              Simuler
            </button>
          </form>
        </Section>

        <Section title="Résultat" description="Intention détectée, prompt utilisé, réponse et destination finale.">
          {result ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Info title="Intention détectée" value={result.matchedIntent} />
                <Info title="Route détectée" value={result.matchedRoute} />
                <Info title="Destination finale" value={result.destination} />
                <Info title="Flow testé" value={selectedFlow?.name ?? "Aucun"} />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Prompt utilisé</p>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{result.promptUsed}</div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Réponse générée</p>
                <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">{result.response}</div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Chemin logique</p>
                <div className="flex flex-wrap gap-2">
                  {result.path.map((step, index) => (
                    <span key={`${step}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Lance une simulation pour voir le chemin logique ici.</p>
          )}
        </Section>
      </div>
    </AdminShell>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
