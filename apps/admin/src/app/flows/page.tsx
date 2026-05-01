import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, Select, TextArea, TextInput } from "@/components/forms";
import { deleteFlowAction, deleteFlowIntentAction, saveFlowAction, saveFlowIntentAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function FlowsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);

  let contexts: Awaited<ReturnType<typeof prisma.context.findMany>> = [];
  let routes: Awaited<ReturnType<typeof prisma.routeRule.findMany>> = [];
  let flows: any[] = [];

  if (tenantId) {
    [contexts, routes, flows] = await Promise.all([
      prisma.context.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.routeRule.findMany({ where: { tenantId, isActive: true }, orderBy: { serviceName: "asc" } }),
      prisma.flow.findMany({
        where: { tenantId },
        include: {
          intents: { include: { routeRule: true }, orderBy: { priority: "asc" } },
        },
        orderBy: { name: "asc" },
      }),
    ]);
  }

  const contextOptions = contexts.map((context) => ({ value: context.id, label: context.name }));
  const routeOptions = routes.map((route) => ({ value: route.id, label: `${route.serviceName} → ${route.extension}` }));

  return (
    <AdminShell title="Flows" subtitle="Parcours conversationnels par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6">
        <Section title="Nouveau flow">
          <form action={saveFlowAction} className="grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <Field label="Nom"><TextInput name="name" required /></Field>
            <Field label="Contexte"><Select name="contextId" options={contextOptions} /></Field>
            <Field label="Message accueil"><TextArea name="welcomeMessage" rows={4} required /></Field>
            <Field label="Prompt silence"><TextArea name="silencePrompt" rows={4} required /></Field>
            <Field label="Prompt ambigu"><TextArea name="ambiguousPrompt" rows={4} required /></Field>
            <Field label="Prompt fallback"><TextArea name="fallbackPrompt" rows={4} required /></Field>
            <Field label="Action finale"><TextInput name="finalAction" defaultValue="transfer" required /></Field>
            <Field label="Libellé destination"><TextInput name="destinationLabel" defaultValue="Réception" required /></Field>
            <Field label="Poste destination"><TextInput name="destinationPost" defaultValue="105" required /></Field>
            <Field label="Max erreurs"><TextInput name="maxFailedAttempts" type="number" defaultValue="2" required /></Field>
            <div className="xl:col-span-2"><Checkbox name="isActive" defaultChecked label="Flow actif" /></div>
            <div className="xl:col-span-2"><SaveButton /></div>
          </form>
        </Section>

        <Section title="Flows existants">
          <div className="space-y-6">
            {flows.map((flow) => (
              <div key={flow.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <form action={saveFlowAction} className="grid gap-4 xl:grid-cols-2">
                  <input type="hidden" name="id" value={flow.id} />
                  <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                  <Field label="Nom"><TextInput name="name" defaultValue={flow.name} required /></Field>
                  <Field label="Contexte"><Select name="contextId" defaultValue={flow.contextId} options={contextOptions} /></Field>
                  <Field label="Message accueil"><TextArea name="welcomeMessage" defaultValue={flow.welcomeMessage} rows={4} required /></Field>
                  <Field label="Prompt silence"><TextArea name="silencePrompt" defaultValue={flow.silencePrompt} rows={4} required /></Field>
                  <Field label="Prompt ambigu"><TextArea name="ambiguousPrompt" defaultValue={flow.ambiguousPrompt} rows={4} required /></Field>
                  <Field label="Prompt fallback"><TextArea name="fallbackPrompt" defaultValue={flow.fallbackPrompt} rows={4} required /></Field>
                  <Field label="Action finale"><TextInput name="finalAction" defaultValue={flow.finalAction} required /></Field>
                  <Field label="Libellé destination"><TextInput name="destinationLabel" defaultValue={flow.destinationLabel} required /></Field>
                  <Field label="Poste destination"><TextInput name="destinationPost" defaultValue={flow.destinationPost} required /></Field>
                  <Field label="Max erreurs"><TextInput name="maxFailedAttempts" type="number" defaultValue={flow.maxFailedAttempts} required /></Field>
                  <div className="xl:col-span-2"><Checkbox name="isActive" defaultChecked={flow.isActive} label="Flow actif" /></div>
                  <div className="xl:col-span-2 flex gap-3"><SaveButton /></div>
                </form>
                <form action={deleteFlowAction} className="mt-3">
                  <input type="hidden" name="id" value={flow.id} />
                  <DeleteButton />
                </form>

                {"intents" in flow ? (
                  <div className="mt-6 space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
                    <h4 className="text-sm font-semibold">Intents</h4>
                    {flow.intents.map((intent: any) => (
                      <div key={intent.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                        <form action={saveFlowIntentAction} className="grid gap-4 xl:grid-cols-2">
                          <input type="hidden" name="id" value={intent.id} />
                          <input type="hidden" name="flowId" value={flow.id} />
                          <Field label="Libellé"><TextInput name="label" defaultValue={intent.label} required /></Field>
                          <Field label="Route liée"><Select name="routeRuleId" defaultValue={intent.routeRuleId} options={routeOptions} /></Field>
                          <Field label="Mots-clés"><TextInput name="keywords" defaultValue={intent.keywords} required /></Field>
                          <Field label="Priorité"><TextInput name="priority" type="number" defaultValue={intent.priority} required /></Field>
                          <Field label="Réponse"><TextArea name="response" defaultValue={intent.response} rows={4} required /></Field>
                          <Field label="Action finale"><TextInput name="finalAction" defaultValue={intent.finalAction} required /></Field>
                          <Field label="Poste destination"><TextInput name="destinationPost" defaultValue={intent.destinationPost} required /></Field>
                          <div className="xl:col-span-2"><Checkbox name="isActive" defaultChecked={intent.isActive} label="Intent active" /></div>
                          <div className="xl:col-span-2"><SaveButton /></div>
                        </form>
                        <form action={deleteFlowIntentAction} className="mt-3">
                          <input type="hidden" name="id" value={intent.id} />
                          <DeleteButton />
                        </form>
                      </div>
                    ))}

                    <form action={saveFlowIntentAction} className="grid gap-4 rounded-xl border border-dashed border-slate-300 p-4 dark:border-white/15 xl:grid-cols-2">
                      <input type="hidden" name="flowId" value={flow.id} />
                      <Field label="Nouvelle intent"><TextInput name="label" required /></Field>
                      <Field label="Route liée"><Select name="routeRuleId" options={routeOptions} /></Field>
                      <Field label="Mots-clés"><TextInput name="keywords" required /></Field>
                      <Field label="Priorité"><TextInput name="priority" type="number" defaultValue="100" required /></Field>
                      <Field label="Réponse"><TextArea name="response" rows={4} required /></Field>
                      <Field label="Action finale"><TextInput name="finalAction" defaultValue="transfer" required /></Field>
                      <Field label="Poste destination"><TextInput name="destinationPost" defaultValue="105" required /></Field>
                      <div className="xl:col-span-2"><Checkbox name="isActive" defaultChecked label="Intent active" /></div>
                      <div className="xl:col-span-2"><SaveButton label="Ajouter l’intent" /></div>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
