import { AdminShell, Section } from "@/components/admin-shell";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function SimulatorPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string; message?: string }> }) {
  await requireAuth();
  const params = searchParams ? await searchParams : {};
  const { tenants, currentTenant, tenantId } = await getTenantContext(params);
  const flows = tenantId ? await prisma.flow.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }) : [];

  return (
    <AdminShell title="Simulateur" subtitle="Prépare les tests pour le client sélectionné" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1fr,1.2fr]">
        <Section title="Préparer un test">
          <form className="grid gap-4" method="get">
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <label className="text-sm font-semibold">Message utilisateur</label>
            <textarea name="message" defaultValue={params.message ?? ""} rows={8} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" />
            <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Mettre à jour</button>
          </form>
        </Section>
        <Section title="Données disponibles">
          <p className="text-sm text-slate-600 dark:text-slate-300/80">Flows actifs pour ce client :</p>
          <ul className="mt-3 space-y-2 text-sm">
            {flows.map((flow) => (
              <li key={flow.id} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">{flow.name}</li>
            ))}
          </ul>
        </Section>
      </div>
    </AdminShell>
  );
}
