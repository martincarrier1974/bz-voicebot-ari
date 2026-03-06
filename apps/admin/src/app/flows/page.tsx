import {
  deleteFlowAction,
  deleteFlowIntentAction,
  saveFlowAction,
  saveFlowIntentAction,
} from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, SaveButton, Select, TextArea, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function FlowsPage() {
  await requireAuth();

  const [flows, contexts, routes] = await Promise.all([
    prisma.flow.findMany({
      include: {
        context: true,
        intents: { include: { routeRule: true }, orderBy: { priority: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.context.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.routeRule.findMany({ orderBy: { priority: "asc" } }),
  ]);

  const contextOptions = contexts.map((context) => ({ value: context.id, label: context.name }));
  const routeOptions = routes.map((route) => ({
    value: route.id,
    label: `${route.serviceName} (${route.extension})`,
  }));

  return (
    <AdminShell
      title="Gestion des flows"
      subtitle="Configurer les scénarios d’appel, leurs intentions et les actions de transfert."
    >
      <div className="space-y-6">
        <Section title="Nouveau flow" description="Créer un flow d’appel principal ou secondaire.">
          <form action={saveFlowAction} className="grid gap-4 xl:grid-cols-2">
            <TextInput name="name" placeholder="Flow principal BZ Telecom" required />
            <Select name="contextId" options={contextOptions} />
            <TextArea name="welcomeMessage" rows={3} placeholder="Message d’accueil" />
            <TextArea name="silencePrompt" rows={3} placeholder="Relance si silence" />
            <TextArea name="ambiguousPrompt" rows={3} placeholder="Clarification si ambigu" />
            <TextArea name="fallbackPrompt" rows={3} placeholder="Réponse si échec / fallback" />
            <TextInput name="finalAction" placeholder="transfer" />
            <TextInput name="destinationLabel" placeholder="Réception / Autres" />
            <TextInput name="destinationPost" placeholder="105" />
            <TextInput name="maxFailedAttempts" placeholder="2" />
            <Checkbox name="isActive" defaultChecked label="Flow actif" />
            <div className="xl:col-span-2">
              <SaveButton label="Créer le flow" />
            </div>
          </form>
        </Section>

        {flows.map((flow) => (
          <Section
            key={flow.id}
            title={flow.name}
            description={`Destination finale par défaut : ${flow.destinationLabel} (${flow.destinationPost})`}
          >
            <form action={saveFlowAction} className="grid gap-4 xl:grid-cols-2">
              <input type="hidden" name="id" value={flow.id} />
              <TextInput name="name" defaultValue={flow.name} required />
              <Select name="contextId" defaultValue={flow.contextId} options={contextOptions} />
              <TextArea name="welcomeMessage" rows={3} defaultValue={flow.welcomeMessage} />
              <TextArea name="silencePrompt" rows={3} defaultValue={flow.silencePrompt} />
              <TextArea name="ambiguousPrompt" rows={3} defaultValue={flow.ambiguousPrompt} />
              <TextArea name="fallbackPrompt" rows={3} defaultValue={flow.fallbackPrompt} />
              <TextInput name="finalAction" defaultValue={flow.finalAction} />
              <TextInput name="destinationLabel" defaultValue={flow.destinationLabel} />
              <TextInput name="destinationPost" defaultValue={flow.destinationPost} />
              <TextInput name="maxFailedAttempts" defaultValue={flow.maxFailedAttempts} />
              <Checkbox name="isActive" defaultChecked={flow.isActive} label="Flow actif" />
              <div className="xl:col-span-2 flex gap-3">
                <SaveButton />
              </div>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h4 className="mb-3 text-base font-semibold">Intentions du flow</h4>
              <div className="space-y-4">
                {flow.intents.map((intent) => (
                  <div key={intent.id} className="rounded-2xl border border-slate-200 p-4">
                    <form action={saveFlowIntentAction} className="grid gap-4 xl:grid-cols-2">
                      <input type="hidden" name="id" value={intent.id} />
                      <input type="hidden" name="flowId" value={flow.id} />
                      <TextInput name="label" defaultValue={intent.label} />
                      <Select name="routeRuleId" defaultValue={intent.routeRuleId} options={routeOptions} />
                      <TextInput name="keywords" defaultValue={intent.keywords} />
                      <TextInput name="destinationPost" defaultValue={intent.destinationPost} />
                      <TextInput name="finalAction" defaultValue={intent.finalAction} />
                      <TextInput name="priority" defaultValue={intent.priority} />
                      <div className="xl:col-span-2">
                        <TextArea name="response" rows={3} defaultValue={intent.response} />
                      </div>
                      <Checkbox name="isActive" defaultChecked={intent.isActive} label="Intention active" />
                      <div className="xl:col-span-2 flex gap-3">
                        <SaveButton />
                      </div>
                    </form>
                    <form action={deleteFlowIntentAction} className="mt-3">
                      <input type="hidden" name="id" value={intent.id} />
                      <DeleteButton />
                    </form>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
                <form action={saveFlowIntentAction} className="grid gap-4 xl:grid-cols-2">
                  <input type="hidden" name="flowId" value={flow.id} />
                  <TextInput name="label" placeholder="Nouvelle intention" />
                  <Select name="routeRuleId" options={routeOptions} />
                  <TextInput name="keywords" placeholder="mots-clés, séparés, par, virgule" />
                  <TextInput name="destinationPost" placeholder="101" />
                  <TextInput name="finalAction" placeholder="transfer" />
                  <TextInput name="priority" placeholder="10" />
                  <div className="xl:col-span-2">
                    <TextArea name="response" rows={3} placeholder="Réponse associée" />
                  </div>
                  <Checkbox name="isActive" defaultChecked label="Intention active" />
                  <div className="xl:col-span-2">
                    <SaveButton label="Ajouter l’intention" />
                  </div>
                </form>
              </div>
            </div>

            <form action={deleteFlowAction} className="mt-5">
              <input type="hidden" name="id" value={flow.id} />
              <DeleteButton />
            </form>
          </Section>
        ))}
      </div>
    </AdminShell>
  );
}
