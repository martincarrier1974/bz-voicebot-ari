import {
  deleteFlowAction,
  deleteFlowIntentAction,
  saveFlowAction,
  saveFlowIntentAction,
} from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import {
  Checkbox,
  DeleteButton,
  Field,
  SaveButton,
  Select,
  TextArea,
  TextInput,
} from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function FlowsPage() {
  await requireAuth();

  const [flows, contexts, routes] = await Promise.all([
    prisma.flow.findMany({
      include: {
        context: true,
        intents: {
          include: {
            routeRule: true,
          },
          orderBy: { priority: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.context.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.routeRule.findMany({
      orderBy: [{ priority: "asc" }, { serviceName: "asc" }],
    }),
  ]);

  const contextOptions = contexts.map((context) => ({
    value: context.id,
    label: context.name,
  }));

  const routeOptions = routes.map((route) => ({
    value: route.id,
    label: `${route.serviceName} (poste ${route.extension})`,
  }));

  return (
    <AdminShell
      title="Flows"
      subtitle="Configurer les parcours d’appel, leurs messages et les intentions de transfert."
      showPublishButton={true}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Section title="Nouveau flow" description="Créer un nouveau parcours avec une destination par défaut.">
          <form action={saveFlowAction} className="space-y-4">
            <Field label="Nom du flow">
              <TextInput name="name" placeholder="Flow principal BZ Telecom" required />
            </Field>

            <Field label="Contexte" hint="Optionnel">
              <Select name="contextId" options={contextOptions} />
            </Field>

            <Field label="Message d’accueil">
              <TextArea
                name="welcomeMessage"
                rows={3}
                placeholder="Bonjour, bienvenue chez BZ Telecom. Comment puis-je vous aider aujourd’hui ?"
                required
              />
            </Field>

            <Field label="Prompt de silence">
              <TextArea
                name="silencePrompt"
                rows={2}
                placeholder="Je suis toujours là. Pouvez-vous répéter, s’il vous plaît ?"
                required
              />
            </Field>

            <Field label="Prompt ambigu">
              <TextArea
                name="ambiguousPrompt"
                rows={2}
                placeholder="Je veux être certain de bien comprendre votre demande."
                required
              />
            </Field>

            <Field label="Prompt de repli">
              <TextArea
                name="fallbackPrompt"
                rows={2}
                placeholder="Je vais vous transférer vers un agent pour vous aider."
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Action finale">
                <Select
                  name="finalAction"
                  required
                  options={[
                    { value: "transfer", label: "Transfert" },
                    { value: "message", label: "Message" },
                    { value: "hangup", label: "Raccrocher" },
                  ]}
                />
              </Field>
              <Field label="Nombre max d’échecs">
                <TextInput name="maxFailedAttempts" defaultValue="2" required inputMode="numeric" />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Libellé destination">
                <TextInput name="destinationLabel" placeholder="Réception / Autres" required />
              </Field>
              <Field label="Poste destination">
                <TextInput name="destinationPost" placeholder="105" required inputMode="numeric" />
              </Field>
            </div>

            <Checkbox name="isActive" defaultChecked label="Flow actif" />
            <SaveButton label="Créer le flow" />
          </form>
        </Section>

        <div className="space-y-6">
          {flows.length === 0 ? (
            <Section title="Aucun flow" description="Crée ton premier flow avec le formulaire à gauche.">
              <p className="text-sm text-slate-500 dark:text-slate-300/75">La liste apparaîtra ici dès la création du premier flow.</p>
            </Section>
          ) : null}

          {flows.map((flow) => (
            <Section
              key={flow.id}
              title={flow.name || "[Flow sans nom à corriger]"}
              description={`Destination par défaut : ${flow.destinationLabel || "-"} (${flow.destinationPost || "-"})`}
            >
              {!flow.name ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Ce flow contient des données incomplètes. Il faut le corriger ou le supprimer.
                </div>
              ) : null}

              <form action={saveFlowAction} className="space-y-4">
                <input type="hidden" name="id" value={flow.id} />

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nom du flow">
                    <TextInput name="name" defaultValue={flow.name} required />
                  </Field>
                  <Field label="Contexte" hint={flow.context?.name ? `Actuel : ${flow.context.name}` : "Optionnel"}>
                    <Select name="contextId" defaultValue={flow.contextId} options={contextOptions} />
                  </Field>
                </div>

                <Field label="Message d’accueil">
                  <TextArea name="welcomeMessage" rows={3} defaultValue={flow.welcomeMessage} required />
                </Field>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Prompt de silence">
                    <TextArea name="silencePrompt" rows={3} defaultValue={flow.silencePrompt} required />
                  </Field>
                  <Field label="Prompt ambigu">
                    <TextArea name="ambiguousPrompt" rows={3} defaultValue={flow.ambiguousPrompt} required />
                  </Field>
                  <Field label="Prompt de repli">
                    <TextArea name="fallbackPrompt" rows={3} defaultValue={flow.fallbackPrompt} required />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Action finale">
                    <Select
                      name="finalAction"
                      defaultValue={flow.finalAction}
                      required
                      options={[
                        { value: "transfer", label: "Transfert" },
                        { value: "message", label: "Message" },
                        { value: "hangup", label: "Raccrocher" },
                      ]}
                    />
                  </Field>
                  <Field label="Libellé destination">
                    <TextInput name="destinationLabel" defaultValue={flow.destinationLabel} required />
                  </Field>
                  <Field label="Poste destination">
                    <TextInput name="destinationPost" defaultValue={flow.destinationPost} required inputMode="numeric" />
                  </Field>
                  <Field label="Nombre max d’échecs">
                    <TextInput
                      name="maxFailedAttempts"
                      defaultValue={flow.maxFailedAttempts}
                      required
                      inputMode="numeric"
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <Checkbox name="isActive" defaultChecked={flow.isActive} label="Flow actif" />
                  <SaveButton />
                </div>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold">Intentions</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-300/75">
                      Mots-clés, priorité et destination de transfert.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {flow.intents.map((intent) => (
                    <div key={intent.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                      <form action={saveFlowIntentAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <input type="hidden" name="id" value={intent.id} />
                        <input type="hidden" name="flowId" value={flow.id} />

                        <Field label="Libellé">
                          <TextInput name="label" defaultValue={intent.label} required />
                        </Field>
                        <Field label="Route liée" hint={intent.routeRule?.serviceName || "Optionnel"}>
                          <Select name="routeRuleId" defaultValue={intent.routeRuleId} options={routeOptions} />
                        </Field>
                        <Field label="Priorité">
                          <TextInput name="priority" defaultValue={intent.priority} required inputMode="numeric" />
                        </Field>

                        <div className="md:col-span-2 xl:col-span-3">
                          <Field label="Mots-clés" hint="Séparés par des virgules">
                            <TextInput name="keywords" defaultValue={intent.keywords} />
                          </Field>
                        </div>

                        <div className="md:col-span-2 xl:col-span-3">
                          <Field label="Réponse">
                            <TextArea name="response" rows={3} defaultValue={intent.response} />
                          </Field>
                        </div>

                        <Field label="Action finale">
                          <Select
                            name="finalAction"
                            defaultValue={intent.finalAction}
                            required
                            options={[
                              { value: "transfer", label: "Transfert" },
                              { value: "message", label: "Message" },
                              { value: "hangup", label: "Raccrocher" },
                            ]}
                          />
                        </Field>
                        <Field label="Poste destination">
                          <TextInput name="destinationPost" defaultValue={intent.destinationPost} required inputMode="numeric" />
                        </Field>
                        <div className="flex flex-col justify-end gap-3">
                          <Checkbox name="isActive" defaultChecked={intent.isActive} label="Intention active" />
                        </div>

                        <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-3">
                          <SaveButton />
                        </div>
                      </form>

                      <form action={deleteFlowIntentAction} className="mt-4">
                        <input type="hidden" name="id" value={intent.id} />
                        <DeleteButton />
                      </form>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-white/15">
                    <h5 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Ajouter une intention</h5>
                    <form action={saveFlowIntentAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <input type="hidden" name="flowId" value={flow.id} />

                      <Field label="Libellé">
                        <TextInput name="label" placeholder="Support technique / support" required />
                      </Field>
                      <Field label="Route liée" hint="Optionnel">
                        <Select name="routeRuleId" options={routeOptions} />
                      </Field>
                      <Field label="Priorité">
                        <TextInput name="priority" defaultValue="100" required inputMode="numeric" />
                      </Field>

                      <div className="md:col-span-2 xl:col-span-3">
                        <Field label="Mots-clés" hint="Séparés par des virgules">
                          <TextInput name="keywords" placeholder="support,technique,informatique" />
                        </Field>
                      </div>

                      <div className="md:col-span-2 xl:col-span-3">
                        <Field label="Réponse">
                          <TextArea name="response" rows={3} placeholder="Je vous transfère vers notre équipe technique." />
                        </Field>
                      </div>

                      <Field label="Action finale">
                        <Select
                          name="finalAction"
                          required
                          options={[
                            { value: "transfer", label: "Transfert" },
                            { value: "message", label: "Message" },
                            { value: "hangup", label: "Raccrocher" },
                          ]}
                        />
                      </Field>
                      <Field label="Poste destination">
                        <TextInput name="destinationPost" placeholder="101" required inputMode="numeric" />
                      </Field>
                      <div className="flex flex-col justify-end gap-3">
                        <Checkbox name="isActive" defaultChecked label="Intention active" />
                      </div>

                      <div className="md:col-span-2 xl:col-span-3">
                        <SaveButton label="Ajouter l’intention" />
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <form action={deleteFlowAction} className="mt-6">
                <input type="hidden" name="id" value={flow.id} />
                <DeleteButton />
              </form>
            </Section>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
