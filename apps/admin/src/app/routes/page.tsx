import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, TextInput } from "@/components/forms";
import { deleteRouteAction, saveRouteAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function RoutesPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);
  const routes = tenantId ? await prisma.routeRule.findMany({ where: { tenantId }, orderBy: [{ priority: "asc" }, { serviceName: "asc" }] }) : [];

  return (
    <AdminShell title="Routes" subtitle="Aiguillage téléphonique par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1fr,1.3fr]">
        <Section title="Nouvelle route">
          <form action={saveRouteAction} className="grid gap-4">
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <Field label="Service"><TextInput name="serviceName" required placeholder="support" /></Field>
            <Field label="Poste"><TextInput name="extension" required placeholder="105" /></Field>
            <Field label="Mots-clés"><TextInput name="keywords" required placeholder="support, aide, assistance" /></Field>
            <Field label="Priorité"><TextInput name="priority" type="number" defaultValue="100" required /></Field>
            <Checkbox name="isActive" defaultChecked label="Route active" />
            <SaveButton />
          </form>
        </Section>
        <Section title="Routes existantes">
          <div className="space-y-4">
            {routes.map((route) => (
              <div key={route.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <form action={saveRouteAction} className="grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="id" value={route.id} />
                  <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                  <Field label="Service"><TextInput name="serviceName" defaultValue={route.serviceName} required /></Field>
                  <Field label="Poste"><TextInput name="extension" defaultValue={route.extension} required /></Field>
                  <div className="md:col-span-2"><Field label="Mots-clés"><TextInput name="keywords" defaultValue={route.keywords} required /></Field></div>
                  <Field label="Priorité"><TextInput name="priority" type="number" defaultValue={route.priority} required /></Field>
                  <div className="flex items-end"><Checkbox name="isActive" defaultChecked={route.isActive} label="Route active" /></div>
                  <div className="md:col-span-2 flex gap-3">
                    <SaveButton />
                  </div>
                </form>
                <form action={deleteRouteAction} className="mt-3">
                  <input type="hidden" name="id" value={route.id} />
                  <DeleteButton />
                </form>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
