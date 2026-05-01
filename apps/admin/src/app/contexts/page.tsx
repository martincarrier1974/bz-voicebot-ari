import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, TextArea, TextInput } from "@/components/forms";
import { deleteContextAction, saveContextAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function ContextsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);
  const contexts = tenantId ? await prisma.context.findMany({ where: { tenantId }, orderBy: { name: "asc" } }) : [];

  return (
    <AdminShell title="Contextes" subtitle="Personnalité et garde-fous par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.4fr]">
        <Section title="Nouveau contexte">
          <form action={saveContextAction} className="grid gap-4">
            <input type="hidden" name="tenantId" value={tenantId ?? ""} />
            <Field label="Nom"><TextInput name="name" required /></Field>
            <Field label="Description"><TextInput name="description" required /></Field>
            <Field label="Instructions"><TextArea name="instructions" rows={6} required /></Field>
            <Field label="Ton de voix"><TextArea name="voiceTone" rows={3} required /></Field>
            <Field label="Règles"><TextArea name="rules" rows={5} required /></Field>
            <Field label="Limites"><TextArea name="limits" rows={4} required /></Field>
            <Field label="Exemples de réponses"><TextArea name="responseExamples" rows={5} required /></Field>
            <Checkbox name="isActive" defaultChecked label="Contexte actif" />
            <SaveButton />
          </form>
        </Section>
        <Section title="Contextes existants">
          <div className="space-y-5">
            {contexts.map((context) => (
              <div key={context.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <form action={saveContextAction} className="grid gap-4">
                  <input type="hidden" name="id" value={context.id} />
                  <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                  <Field label="Nom"><TextInput name="name" defaultValue={context.name} required /></Field>
                  <Field label="Description"><TextInput name="description" defaultValue={context.description} required /></Field>
                  <Field label="Instructions"><TextArea name="instructions" defaultValue={context.instructions} rows={6} required /></Field>
                  <Field label="Ton de voix"><TextArea name="voiceTone" defaultValue={context.voiceTone} rows={3} required /></Field>
                  <Field label="Règles"><TextArea name="rules" defaultValue={context.rules} rows={5} required /></Field>
                  <Field label="Limites"><TextArea name="limits" defaultValue={context.limits} rows={4} required /></Field>
                  <Field label="Exemples de réponses"><TextArea name="responseExamples" defaultValue={context.responseExamples} rows={5} required /></Field>
                  <Checkbox name="isActive" defaultChecked={context.isActive} label="Contexte actif" />
                  <SaveButton />
                </form>
                <form action={deleteContextAction} className="mt-3">
                  <input type="hidden" name="id" value={context.id} />
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
