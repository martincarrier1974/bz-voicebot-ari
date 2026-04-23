import { deletePromptAction, savePromptAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, SaveButton, TextArea, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PromptsPage() {
  await requireAuth();

  const prompts = await prisma.prompt.findMany({
    include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: [{ scenario: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <AdminShell
      title="Gestion des prompts"
      subtitle="Créer, modifier, activer et versionner les prompts utilisés par l’agent vocal."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Section title="Nouveau prompt" description="Ajouter un prompt ou sous-prompt par scénario.">
          <form action={savePromptAction} className="space-y-4">
            <TextInput name="key" placeholder="greeting" required />
            <TextInput name="name" placeholder="Prompt accueil" required />
            <TextInput name="scenario" placeholder="accueil" required />
            <TextInput name="description" placeholder="Description courte" />
            <TextArea name="content" rows={6} placeholder="Contenu du prompt..." />
            <Checkbox name="isActive" defaultChecked label="Actif" />
            <SaveButton label="Créer le prompt" />
          </form>
        </Section>

        <div className="space-y-6">
          {prompts.map((prompt) => (
            <Section
              key={prompt.id}
              title={prompt.name}
              description={`Scénario : ${prompt.scenario} | clé : ${prompt.key}`}
            >
              <form action={savePromptAction} className="space-y-4">
                <input type="hidden" name="id" value={prompt.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput name="key" defaultValue={prompt.key} required />
                  <TextInput name="name" defaultValue={prompt.name} required />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput name="scenario" defaultValue={prompt.scenario} required />
                  <TextInput name="description" defaultValue={prompt.description} />
                </div>
                <TextArea name="content" rows={5} defaultValue={prompt.content} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Checkbox name="isActive" defaultChecked={prompt.isActive} label="Prompt actif" />
                  <div className="flex gap-3">
                    <SaveButton />
                  </div>
                </div>
              </form>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="mb-2 text-sm font-medium text-slate-700">Historique simple</p>
                <div className="space-y-2">
                  {prompt.versions.map((version) => (
                    <div key={version.id} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      <div className="mb-1 font-medium">
                        {new Date(version.createdAt).toLocaleString("fr-CA")} {version.note ? `• ${version.note}` : ""}
                      </div>
                      <div className="line-clamp-3 whitespace-pre-wrap">{version.content}</div>
                    </div>
                  ))}
                </div>
              </div>

              <form action={deletePromptAction} className="mt-4">
                <input type="hidden" name="id" value={prompt.id} />
                <DeleteButton />
              </form>
            </Section>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
