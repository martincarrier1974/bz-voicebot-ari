import { deleteContextAction, saveContextAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, SaveButton, TextArea, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Context } from "@prisma/client";

export default async function ContextsPage() {
  await requireAuth();
  const contexts = await prisma.context.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <AdminShell title="Contextes" subtitle="Définir les contextes métier, règles, ton et exemples de réponses." showPublishButton={true}>
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Section title="Nouveau contexte">
          <form action={saveContextAction} className="space-y-4">
            <TextInput name="name" placeholder="Support B2B" required />
            <TextInput name="description" placeholder="Description" required />
            <TextArea name="instructions" rows={4} placeholder="Consignes" />
            <TextInput name="voiceTone" placeholder="Professionnel, calme, chaleureux" />
            <TextArea name="rules" rows={4} placeholder="Règles à respecter" />
            <TextArea name="limits" rows={4} placeholder="Limites" />
            <TextArea name="responseExamples" rows={4} placeholder="Exemples de réponses" />
            <Checkbox name="isActive" defaultChecked label="Contexte actif" />
            <SaveButton label="Créer le contexte" />
          </form>
        </Section>

        <div className="space-y-6">
          {contexts.map((context: Context) => (
            <Section key={context.id} title={context.name} description={context.description}>
              <form action={saveContextAction} className="space-y-4">
                <input type="hidden" name="id" value={context.id} />
                <TextInput name="name" defaultValue={context.name} />
                <TextInput name="description" defaultValue={context.description} />
                <TextArea name="instructions" rows={4} defaultValue={context.instructions} />
                <TextInput name="voiceTone" defaultValue={context.voiceTone} />
                <TextArea name="rules" rows={4} defaultValue={context.rules} />
                <TextArea name="limits" rows={4} defaultValue={context.limits} />
                <TextArea name="responseExamples" rows={4} defaultValue={context.responseExamples} />
                <div className="flex items-center justify-between">
                  <Checkbox name="isActive" defaultChecked={context.isActive} label="Contexte actif" />
                  <SaveButton />
                </div>
              </form>
              <form action={deleteContextAction} className="mt-4">
                <input type="hidden" name="id" value={context.id} />
                <DeleteButton />
              </form>
            </Section>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
