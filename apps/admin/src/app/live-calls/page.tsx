import { AdminShell, Section } from "@/components/admin-shell";
import { requireAuth } from "@/lib/auth";
import { readLiveCallsSnapshot } from "@/lib/live-calls";
import { getTenantContext } from "@/lib/tenant";

export default async function LiveCallsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant } = await getTenantContext(searchParams);
  const snapshot = readLiveCallsSnapshot(currentTenant);

  return (
    <AdminShell title="Appels en direct" subtitle="Lecture du runtime du client sélectionné" tenants={tenants} currentTenant={currentTenant}>
      <Section title="Sessions actives" description={`Mise à jour: ${new Date(snapshot.updatedAt).toLocaleString("fr-CA")}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300/80">{snapshot.count} appel(s) actif(s)</p>
          {snapshot.calls.map((call) => (
            <div key={call.session.callId} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <p className="font-semibold">{call.session.businessName || "Appel en cours"}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300/75">Call ID: {call.session.callId}</p>
              <p className="mt-2 text-sm">Session: {call.session.sessionId}</p>
            </div>
          ))}
        </div>
      </Section>
    </AdminShell>
  );
}
