import { AdminShell, Card, Section } from "@/components/admin-shell";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);

  if (!currentTenant || !tenantId) {
    return (
      <AdminShell title="Dashboard" subtitle="Crée d’abord un client pour commencer." tenants={tenants}>
        <Section title="Aucun client" description="L’admin centrale est prête, mais aucun client actif n’existe encore.">
          <p className="text-sm text-slate-600 dark:text-slate-300/80">Ajoute un client dans l’onglet Clients, puis reviens ici.</p>
        </Section>
      </AdminShell>
    );
  }

  const [promptCount, contextCount, flowCount, routeCount, bookingServiceCount, lastPublished] = await Promise.all([
    prisma.prompt.count({ where: { tenantId, isActive: true } }),
    prisma.context.count({ where: { tenantId, isActive: true } }),
    prisma.flow.count({ where: { tenantId, isActive: true } }),
    prisma.routeRule.count({ where: { tenantId, isActive: true } }),
    prisma.bookingService.count({ where: { tenantId, isActive: true } }),
    prisma.setting.findFirst({ where: { tenantId, key: "runtime_last_published_at" } }),
  ]);

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Vue d’ensemble du client sélectionné"
      showPublishButton
      tenants={tenants}
      currentTenant={currentTenant}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Prompts actifs" value={promptCount} />
        <Card title="Contextes actifs" value={contextCount} />
        <Card title="Flows actifs" value={flowCount} />
        <Card title="Routes actives" value={routeCount} />
        <Card title="Services booking" value={bookingServiceCount} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Section title="Publication runtime" description="Chaque client publie maintenant son propre fichier runtime dédié.">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <dt className="text-slate-500 dark:text-slate-300/70">Dernière publication</dt>
              <dd className="mt-2 font-semibold">{lastPublished?.value ? new Date(lastPublished.value).toLocaleString("fr-CA") : "Jamais"}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <dt className="text-slate-500 dark:text-slate-300/70">Client</dt>
              <dd className="mt-2 font-semibold">{currentTenant.name}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Rappel architecture" description="Mode retenu : une admin centrale, un runtime isolé par client.">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300/80">
            <li>Données métier filtrées par client dans l’admin.</li>
            <li>Publication runtime dans un dossier dédié par client.</li>
            <li>Les appels live utilisent le fichier du runtime du client sélectionné.</li>
          </ul>
        </Section>
      </div>
    </AdminShell>
  );
}
