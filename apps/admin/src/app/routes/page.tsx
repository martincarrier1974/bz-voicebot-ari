import { deleteRouteAction, saveRouteAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function RoutesPage() {
  await requireAuth();
  const routes = await prisma.routeRule.findMany({ orderBy: { priority: "asc" } });

  return (
    <AdminShell title="Routes d’appel" subtitle="Configurer les destinations, mots-clés, priorité et état actif/inactif.">
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Section title="Nouvelle route">
          <form action={saveRouteAction} className="space-y-4">
            <Field label="Nom du service" hint="Visible dans l’admin">
              <TextInput name="serviceName" placeholder="Support technique" required />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Poste (extension)" hint="Ex: 101">
                <TextInput name="extension" placeholder="101" required inputMode="numeric" />
              </Field>
              <Field label="Priorité" hint="Plus petit = plus prioritaire">
                <TextInput name="priority" placeholder="10" required inputMode="numeric" />
              </Field>
            </div>
            <Field label="Mots-clés" hint="Séparés par des virgules">
              <TextInput name="keywords" placeholder="internet,panne,support,technique" />
            </Field>
            <Checkbox name="isActive" defaultChecked label="Activer cette route (recommandé)" />
            <SaveButton label="Créer la route" />
          </form>
        </Section>

        <div className="space-y-6">
          {routes.map((route) => (
            <Section key={route.id} title={route.serviceName} description={`Poste ${route.extension}`}>
              <form action={saveRouteAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={route.id} />
                <Field label="Nom du service">
                  <TextInput name="serviceName" defaultValue={route.serviceName} required />
                </Field>
                <Field label="Poste (extension)">
                  <TextInput name="extension" defaultValue={route.extension} required inputMode="numeric" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Mots-clés" hint="Séparés par des virgules">
                    <TextInput name="keywords" defaultValue={route.keywords} />
                  </Field>
                </div>
                <Field label="Priorité" hint="Plus petit = plus prioritaire">
                  <TextInput name="priority" defaultValue={route.priority} required inputMode="numeric" />
                </Field>
                <Checkbox name="isActive" defaultChecked={route.isActive} label="Route active" />
                <div className="md:col-span-2 flex gap-3">
                  <SaveButton />
                </div>
              </form>
              <form action={deleteRouteAction} className="mt-4">
                <input type="hidden" name="id" value={route.id} />
                <DeleteButton />
              </form>
            </Section>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
