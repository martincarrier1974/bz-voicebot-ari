import { AdminShell, Card, Section } from "@/components/admin-shell";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  await requireAuth();

  const [promptCount, contextCount, flowCount, routeCount, latestFlow, flows] = await Promise.all([
    prisma.prompt.count(),
    prisma.context.count(),
    prisma.flow.count(),
    prisma.routeRule.count({ where: { isActive: true } }),
    prisma.flow.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.flow.findMany({
      include: { context: true, intents: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Vue d’ensemble du système d’administration BZ Telecom Admin."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Prompts" value={promptCount} hint="Prompts actifs et scénarios" />
        <Card title="Contextes" value={contextCount} hint="Contextes métier disponibles" />
        <Card title="Flows" value={flowCount} hint="Flows configurés" />
        <Card
          title="Routes actives"
          value={routeCount}
          hint={latestFlow ? `Dernier flow modifié : ${latestFlow.name}` : "Aucun flow"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Section title="Derniers flows" description="Flows récemment modifiés et leurs destinations par défaut.">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Flow</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Contexte</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Intentions</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {flows.map((flow) => (
                  <tr key={flow.id}>
                    <td className="px-4 py-3 font-medium">{flow.name}</td>
                    <td className="px-4 py-3 text-slate-600">{flow.context?.name ?? "Aucun"}</td>
                    <td className="px-4 py-3 text-slate-600">{flow.intents.length}</td>
                    <td className="px-4 py-3 text-slate-600">{flow.destinationLabel} ({flow.destinationPost})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Règles clés" description="Résumé fonctionnel de la logique actuelle.">
          <ul className="space-y-3 text-sm text-slate-700">
            <li>Support technique : transfert vers le poste 101.</li>
            <li>Ventes / soumission : transfert vers le poste 102.</li>
            <li>Réception / autres : transfert vers le poste 105.</li>
            <li>Après 2 échecs de compréhension : transfert automatique vers 105.</li>
            <li>Le simulateur permet de tester le chemin logique sans appel réel.</li>
          </ul>
        </Section>
      </div>
    </AdminShell>
  );
}
