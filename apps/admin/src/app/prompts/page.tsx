import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, TextArea, TextInput } from "@/components/forms";
import { deletePromptAction, savePromptAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function PromptsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);
  const prompts = tenantId ? await prisma.prompt.findMany({ where: { tenantId }, orderBy: [{ scenario: "asc" }, { name: "asc" }] }) : [];

  return (
    <AdminShell title="Prompts" subtitle="Prompts scoppés par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.4fr]">
        <Section title="Nouveau prompt">
          <form action={savePromptAction} className="grid gap-4">
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <Field label="Clé"><TextInput name="key" required placeholder="main_agent_prompt" /></Field>
            <Field label="Nom"><TextInput name="name" required placeholder="Prompt principal" /></Field>
            <Field label="Scénario"><TextInput name="scenario" required placeholder="main" /></Field>
            <Field label="Description"><TextInput name="description" placeholder="Utilisation de ce prompt" /></Field>
            <Field label="Contenu"><TextArea name="content" rows={10} required /></Field>
            <Checkbox name="isActive" defaultChecked label="Prompt actif" />
            <SaveButton />
          </form>
        </Section>
        <Section title="Prompts existants">
          <div className="space-y-5">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <form action={savePromptAction} className="grid gap-4">
                  <input type="hidden" name="id" value={prompt.id} />
                  <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Clé"><TextInput name="key" defaultValue={prompt.key} required /></Field>
                    <Field label="Scénario"><TextInput name="scenario" defaultValue={prompt.scenario} required /></Field>
                  </div>
                  <Field label="Nom"><TextInput name="name" defaultValue={prompt.name} required /></Field>
                  <Field label="Description"><TextInput name="description" defaultValue={prompt.description} /></Field>
                  <Field label="Contenu"><TextArea name="content" defaultValue={prompt.content} rows={8} required /></Field>
                  <Checkbox name="isActive" defaultChecked={prompt.isActive} label="Prompt actif" />
                  <SaveButton />
                </form>
                <form action={deletePromptAction} className="mt-3">
                  <input type="hidden" name="id" value={prompt.id} />
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
