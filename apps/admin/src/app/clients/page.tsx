import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, TextArea, TextInput } from "@/components/forms";
import { deleteTenantAction, saveTenantAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext, getRuntimeConfigPathForTenant } from "@/lib/tenant";

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant } = await getTenantContext(searchParams);
  const allTenants = await prisma.tenant.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });

  return (
    <AdminShell title="Clients" subtitle="Gestion centrale des clients et de leurs runtimes" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.4fr]">
        <Section title="Nouveau client" description="Chaque client publie vers son propre runtime/tenants/<slug>/voicebot-config.json">
          <form action={saveTenantAction} className="grid gap-4">
            <Field label="Nom">
              <TextInput name="name" required placeholder="Ex. Clinique Alpha" />
            </Field>
            <Field label="Slug" hint="Laisse vide pour le générer depuis le nom">
              <TextInput name="slug" placeholder="clinique-alpha" />
            </Field>
            <Field label="Chemin runtime" hint="Chemin relatif depuis la racine du repo">
              <TextInput name="runtimeConfigPath" placeholder={getRuntimeConfigPathForTenant({ slug: "clinique-alpha" })} />
            </Field>
            <Field label="Notes">
              <TextArea name="notes" rows={4} placeholder="Infos opératoires, PM2, particularités client..." />
            </Field>
            <Checkbox name="isActive" defaultChecked label="Client actif" />
            <SaveButton label="Créer le client" />
          </form>
        </Section>

        <Section title="Clients existants" description="Modifier le slug ou le chemin runtime si tu veux un dossier runtime spécifique.">
          <div className="space-y-5">
            {allTenants.map((tenant) => (
              <div key={tenant.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <form action={saveTenantAction} className="grid gap-4">
                  <input type="hidden" name="id" value={tenant.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nom">
                      <TextInput name="name" defaultValue={tenant.name} required />
                    </Field>
                    <Field label="Slug">
                      <TextInput name="slug" defaultValue={tenant.slug} required />
                    </Field>
                  </div>
                  <Field label="Chemin runtime">
                    <TextInput name="runtimeConfigPath" defaultValue={tenant.runtimeConfigPath} />
                  </Field>
                  <Field label="Notes">
                    <TextArea name="notes" defaultValue={tenant.notes} rows={3} />
                  </Field>
                  <Checkbox name="isActive" defaultChecked={tenant.isActive} label="Client actif" />
                  <div className="flex gap-3">
                    <SaveButton />
                  </div>
                </form>
                <form action={deleteTenantAction} className="mt-3">
                  <input type="hidden" name="id" value={tenant.id} />
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
