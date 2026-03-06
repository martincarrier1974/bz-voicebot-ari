import { deleteRouteAction, saveRouteAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, SaveButton, TextInput } from "@/components/forms";
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
            <TextInput name="serviceName" placeholder="Support technique" />
            <TextInput name="extension" placeholder="101" />
            <TextInput name="keywords" placeholder="internet,panne,support,technique" />
            <TextInput name="priority" placeholder="10" />
            <Checkbox name="isActive" defaultChecked label="Route active" />
            <SaveButton label="Créer la route" />
          </form>
        </Section>

        <div className="space-y-6">
          {routes.map((route) => (
            <Section key={route.id} title={route.serviceName} description={`Poste ${route.extension}`}>
              <form action={saveRouteAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={route.id} />
                <TextInput name="serviceName" defaultValue={route.serviceName} />
                <TextInput name="extension" defaultValue={route.extension} />
                <div className="md:col-span-2">
                  <TextInput name="keywords" defaultValue={route.keywords} />
                </div>
                <TextInput name="priority" defaultValue={route.priority} />
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
