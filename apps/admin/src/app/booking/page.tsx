import {
  deleteBookingServiceAction,
  deleteBookingServiceResourceAction,
  deleteCalendarConnectionAction,
  deleteCalendarResourceAction,
  saveBookingServiceAction,
  saveBookingServiceResourceAction,
  saveCalendarConnectionAction,
  saveCalendarResourceAction,
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

const PROVIDER_OPTIONS = [
  { value: "m365", label: "Microsoft 365 / Outlook" },
  { value: "google", label: "Google / Gmail" },
];

export default async function BookingPage() {
  await requireAuth();

  const [services, connections, resources, assignments] = await Promise.all([
    prisma.bookingService.findMany({
      include: { resources: { include: { calendarResource: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.calendarConnection.findMany({
      include: { resources: true },
      orderBy: { name: "asc" },
    }),
    prisma.calendarResource.findMany({
      include: { connection: true, services: { include: { bookingService: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.bookingServiceResource.findMany({
      include: { bookingService: true, calendarResource: { include: { connection: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const connectionOptions = connections.map((connection: (typeof connections)[number]) => ({
    value: connection.id,
    label: `${connection.name} (${connection.provider === "google" ? "Google" : "M365"})`,
  }));

  const serviceOptions = services.map((service: (typeof services)[number]) => ({
    value: service.id,
    label: `${service.name} (${service.durationMin} min)`,
  }));

  const resourceOptions = resources.map((resource: (typeof resources)[number]) => ({
    value: resource.id,
    label: `${resource.name} — ${resource.connection.name}`,
  }));

  return (
    <AdminShell
      title="Réservations"
      subtitle="Prestations, connexions calendrier, employés/ressources et affectations pour la prise de rendez-vous."
      showPublishButton={true}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Nouvelle prestation" description="Ex: permanente = 60 min, coupe = 30 min.">
          <form action={saveBookingServiceAction} className="space-y-4">
            <Field label="Nom de la prestation">
              <TextInput name="name" placeholder="Permanente" required />
            </Field>
            <Field label="Slug" hint="Optionnel, sinon généré automatiquement">
              <TextInput name="slug" placeholder="permanente" />
            </Field>
            <Field label="Description" hint="Optionnel">
              <TextArea name="description" rows={3} placeholder="Traitement + mise en forme" />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Durée (min)">
                <TextInput name="durationMin" defaultValue="60" required inputMode="numeric" />
              </Field>
              <Field label="Buffer avant">
                <TextInput name="bufferBeforeMin" defaultValue="0" required inputMode="numeric" />
              </Field>
              <Field label="Buffer après">
                <TextInput name="bufferAfterMin" defaultValue="0" required inputMode="numeric" />
              </Field>
            </div>
            <Checkbox name="isActive" defaultChecked label="Prestation active" />
            <SaveButton label="Créer la prestation" />
          </form>
        </Section>

        <Section title="Prestations" description="Durées et temps tampons utilisés pour calculer les disponibilités.">
          <div className="space-y-5">
            {services.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune prestation configurée pour le moment.</p>
            ) : (
              services.map((service: (typeof services)[number]) => (
                <div key={service.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveBookingServiceAction} className="space-y-4">
                    <input type="hidden" name="id" value={service.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nom">
                        <TextInput name="name" defaultValue={service.name} required />
                      </Field>
                      <Field label="Slug">
                        <TextInput name="slug" defaultValue={service.slug} required />
                      </Field>
                    </div>
                    <Field label="Description" hint="Optionnel">
                      <TextArea name="description" rows={2} defaultValue={service.description} />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Durée (min)">
                        <TextInput name="durationMin" defaultValue={service.durationMin} required inputMode="numeric" />
                      </Field>
                      <Field label="Buffer avant">
                        <TextInput name="bufferBeforeMin" defaultValue={service.bufferBeforeMin} required inputMode="numeric" />
                      </Field>
                      <Field label="Buffer après">
                        <TextInput name="bufferAfterMin" defaultValue={service.bufferAfterMin} required inputMode="numeric" />
                      </Field>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Checkbox name="isActive" defaultChecked={service.isActive} label="Prestation active" />
                      <SaveButton />
                    </div>
                  </form>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Ressources liées : {service.resources.length > 0 ? service.resources.map((item) => item.calendarResource.name).join(", ") : "aucune"}
                  </div>
                  <form action={deleteBookingServiceAction} className="mt-4">
                    <input type="hidden" name="id" value={service.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Nouvelle connexion calendrier" description="Espace pour inscrire les infos de connexion Microsoft 365 ou Gmail.">
          <form action={saveCalendarConnectionAction} className="space-y-4">
            <Field label="Nom interne">
              <TextInput name="name" placeholder="Salon principal M365" required />
            </Field>
            <Field label="Provider">
              <Select name="provider" defaultValue="m365" options={PROVIDER_OPTIONS} required />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tenant ID (M365)" hint="Laisser vide pour Google">
                <TextInput name="tenantId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Field>
              <Field label="Client ID">
                <TextInput name="clientId" placeholder="Application OAuth / Azure" />
              </Field>
            </div>
            <Field label="Client Secret">
              <TextInput name="clientSecret" placeholder="Secret OAuth" />
            </Field>
            <Field label="Refresh Token Google" hint="Pour Gmail/Google Calendar si nécessaire">
              <TextArea name="refreshToken" rows={3} placeholder="Refresh token Google" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Compte / email technique">
                <TextInput name="accountEmail" placeholder="agenda@monsalon.com" />
              </Field>
              <Field label="Calendrier par défaut" hint="Optionnel">
                <TextInput name="defaultCalendarId" placeholder="primary ou ID du calendrier" />
              </Field>
            </div>
            <Field label="Timezone" hint="Ex: America/Toronto">
              <TextInput name="timezone" defaultValue="America/Toronto" />
            </Field>
            <Checkbox name="isActive" defaultChecked label="Connexion active" />
            <SaveButton label="Créer la connexion" />
          </form>
        </Section>

        <Section title="Connexions calendrier" description="Les credentials sont gardés ici pour brancher les disponibilités et réservations ensuite.">
          <div className="space-y-5">
            {connections.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune connexion calendrier configurée.</p>
            ) : (
              connections.map((connection: (typeof connections)[number]) => (
                <div key={connection.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveCalendarConnectionAction} className="space-y-4">
                    <input type="hidden" name="id" value={connection.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nom interne">
                        <TextInput name="name" defaultValue={connection.name} required />
                      </Field>
                      <Field label="Provider">
                        <Select name="provider" defaultValue={connection.provider} options={PROVIDER_OPTIONS} required />
                      </Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Tenant ID (M365)">
                        <TextInput name="tenantId" defaultValue={connection.tenantId} />
                      </Field>
                      <Field label="Client ID">
                        <TextInput name="clientId" defaultValue={connection.clientId} />
                      </Field>
                    </div>
                    <Field label="Client Secret">
                      <TextInput name="clientSecret" defaultValue={connection.clientSecret} />
                    </Field>
                    <Field label="Refresh Token Google">
                      <TextArea name="refreshToken" rows={2} defaultValue={connection.refreshToken} />
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Compte / email technique">
                        <TextInput name="accountEmail" defaultValue={connection.accountEmail} />
                      </Field>
                      <Field label="Calendrier par défaut">
                        <TextInput name="defaultCalendarId" defaultValue={connection.defaultCalendarId} />
                      </Field>
                    </div>
                    <Field label="Timezone">
                      <TextInput name="timezone" defaultValue={connection.timezone} />
                    </Field>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Checkbox name="isActive" defaultChecked={connection.isActive} label="Connexion active" />
                      <SaveButton />
                    </div>
                  </form>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Ressources liées : {connection.resources.length}
                  </div>
                  <form action={deleteCalendarConnectionAction} className="mt-4">
                    <input type="hidden" name="id" value={connection.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Nouvel employé / calendrier" description="Ex: Julie → calendrier Outlook/Gmail spécifique.">
          <form action={saveCalendarResourceAction} className="space-y-4">
            <Field label="Nom interne de la ressource">
              <TextInput name="name" placeholder="Julie - coiffure" required />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nom affiché employé" hint="Optionnel">
                <TextInput name="employeeName" placeholder="Julie" />
              </Field>
              <Field label="Connexion calendrier">
                <Select name="connectionId" options={connectionOptions} required />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Calendar ID">
                <TextInput name="calendarId" placeholder="primary ou adresse/ID calendrier" required />
              </Field>
              <Field label="Adresse calendrier" hint="Optionnel">
                <TextInput name="calendarAddress" placeholder="julie@monsalon.com" />
              </Field>
            </div>
            <Field label="Timezone">
              <TextInput name="timezone" defaultValue="America/Toronto" />
            </Field>
            <Field label="Notes de booking" hint="Optionnel">
              <TextArea name="bookingNotes" rows={3} placeholder="Ne prend pas de cliente le jeudi soir, etc." />
            </Field>
            <Checkbox name="isActive" defaultChecked label="Ressource active" />
            <SaveButton label="Créer la ressource" />
          </form>
        </Section>

        <Section title="Employés / calendriers" description="Chaque ressource pointe vers le bon calendrier à utiliser pour la réservation.">
          <div className="space-y-5">
            {resources.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ressource calendrier configurée.</p>
            ) : (
              resources.map((resource: (typeof resources)[number]) => (
                <div key={resource.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveCalendarResourceAction} className="space-y-4">
                    <input type="hidden" name="id" value={resource.id} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nom interne">
                        <TextInput name="name" defaultValue={resource.name} required />
                      </Field>
                      <Field label="Nom employé">
                        <TextInput name="employeeName" defaultValue={resource.employeeName} />
                      </Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Connexion calendrier">
                        <Select name="connectionId" defaultValue={resource.connectionId} options={connectionOptions} required />
                      </Field>
                      <Field label="Calendar ID">
                        <TextInput name="calendarId" defaultValue={resource.calendarId} required />
                      </Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Adresse calendrier">
                        <TextInput name="calendarAddress" defaultValue={resource.calendarAddress} />
                      </Field>
                      <Field label="Timezone">
                        <TextInput name="timezone" defaultValue={resource.timezone} />
                      </Field>
                    </div>
                    <Field label="Notes de booking">
                      <TextArea name="bookingNotes" rows={2} defaultValue={resource.bookingNotes} />
                    </Field>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Checkbox name="isActive" defaultChecked={resource.isActive} label="Ressource active" />
                      <SaveButton />
                    </div>
                  </form>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Services liés : {resource.services.length > 0 ? resource.services.map((item) => item.bookingService.name).join(", ") : "aucun"}
                  </div>
                  <form action={deleteCalendarResourceAction} className="mt-4">
                    <input type="hidden" name="id" value={resource.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Nouvelle affectation" description="Associe une prestation aux bons calendriers/employés.">
          <form action={saveBookingServiceResourceAction} className="space-y-4">
            <Field label="Prestation">
              <Select name="bookingServiceId" options={serviceOptions} required />
            </Field>
            <Field label="Ressource calendrier">
              <Select name="calendarResourceId" options={resourceOptions} required />
            </Field>
            <Field label="Priorité" hint="Plus petit = proposé avant les autres">
              <TextInput name="priority" defaultValue="100" required inputMode="numeric" />
            </Field>
            <Checkbox name="isActive" defaultChecked label="Affectation active" />
            <SaveButton label="Créer l’affectation" />
          </form>
        </Section>

        <Section title="Affectations service → calendrier" description="Permet de savoir quel employé/calendrier peut prendre quel type de rendez-vous.">
          <div className="space-y-5">
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune affectation configurée.</p>
            ) : (
              assignments.map((assignment: (typeof assignments)[number]) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveBookingServiceResourceAction} className="grid gap-4 md:grid-cols-3">
                    <input type="hidden" name="id" value={assignment.id} />
                    <Field label="Prestation">
                      <Select name="bookingServiceId" defaultValue={assignment.bookingServiceId} options={serviceOptions} required />
                    </Field>
                    <Field label="Ressource calendrier">
                      <Select name="calendarResourceId" defaultValue={assignment.calendarResourceId} options={resourceOptions} required />
                    </Field>
                    <Field label="Priorité">
                      <TextInput name="priority" defaultValue={assignment.priority} required inputMode="numeric" />
                    </Field>
                    <div className="md:col-span-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Checkbox name="isActive" defaultChecked={assignment.isActive} label="Affectation active" />
                      <SaveButton />
                    </div>
                  </form>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    {assignment.bookingService.name} → {assignment.calendarResource.name} ({assignment.calendarResource.connection.name})
                  </div>
                  <form action={deleteBookingServiceResourceAction} className="mt-4">
                    <input type="hidden" name="id" value={assignment.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
