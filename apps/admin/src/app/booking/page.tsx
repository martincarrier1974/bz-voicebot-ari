import { AdminShell, Section } from "@/components/admin-shell";
import { Checkbox, DeleteButton, Field, SaveButton, Select, TextArea, TextInput } from "@/components/forms";
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
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext } from "@/lib/tenant";

export default async function BookingPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);

  let services: Awaited<ReturnType<typeof prisma.bookingService.findMany>> = [];
  let connections: Awaited<ReturnType<typeof prisma.calendarConnection.findMany>> = [];
  let resources: Awaited<ReturnType<typeof prisma.calendarResource.findMany>> = [];
  let mappings: Awaited<ReturnType<typeof prisma.bookingServiceResource.findMany>> = [];

  if (tenantId) {
    [services, connections, resources, mappings] = await Promise.all([
      prisma.bookingService.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.calendarConnection.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.calendarResource.findMany({ where: { tenantId }, include: { connection: true }, orderBy: { name: "asc" } }),
      prisma.bookingServiceResource.findMany({
        where: {
          bookingService: { tenantId },
          calendarResource: { tenantId },
        },
        include: { bookingService: true, calendarResource: true },
        orderBy: { priority: "asc" },
      }),
    ]);
  }

  const serviceOptions = services.map((service) => ({ value: service.id, label: service.name }));
  const connectionOptions = connections.map((connection) => ({ value: connection.id, label: connection.name }));
  const resourceOptions = resources.map((resource) => ({ value: resource.id, label: resource.name }));

  return (
    <AdminShell title="Réservations" subtitle="Services, connexions calendrier et ressources par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="space-y-6">
        <Section title="Services de réservation">
          <div className="grid gap-6 xl:grid-cols-[1fr,1.2fr]">
            <form action={saveBookingServiceAction} className="grid gap-4">
              <input type="hidden" name="tenantId" value={tenantId ?? ""} />
              <Field label="Nom"><TextInput name="name" required /></Field>
              <Field label="Slug"><TextInput name="slug" placeholder="consultation-initiale" /></Field>
              <Field label="Description"><TextArea name="description" rows={4} /></Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Durée (min)"><TextInput name="durationMin" type="number" defaultValue="30" required /></Field>
                <Field label="Buffer avant"><TextInput name="bufferBeforeMin" type="number" defaultValue="0" required /></Field>
                <Field label="Buffer après"><TextInput name="bufferAfterMin" type="number" defaultValue="0" required /></Field>
              </div>
              <Checkbox name="isActive" defaultChecked label="Service actif" />
              <SaveButton />
            </form>
            <div className="space-y-4">
              {services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveBookingServiceAction} className="grid gap-4">
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                    <Field label="Nom"><TextInput name="name" defaultValue={service.name} required /></Field>
                    <Field label="Slug"><TextInput name="slug" defaultValue={service.slug} required /></Field>
                    <Field label="Description"><TextArea name="description" defaultValue={service.description} rows={3} /></Field>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Durée (min)"><TextInput name="durationMin" type="number" defaultValue={service.durationMin} required /></Field>
                      <Field label="Buffer avant"><TextInput name="bufferBeforeMin" type="number" defaultValue={service.bufferBeforeMin} required /></Field>
                      <Field label="Buffer après"><TextInput name="bufferAfterMin" type="number" defaultValue={service.bufferAfterMin} required /></Field>
                    </div>
                    <Checkbox name="isActive" defaultChecked={service.isActive} label="Service actif" />
                    <SaveButton />
                  </form>
                  <form action={deleteBookingServiceAction} className="mt-3">
                    <input type="hidden" name="id" value={service.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Connexions calendrier">
          <div className="grid gap-6 xl:grid-cols-[1fr,1.2fr]">
            <form action={saveCalendarConnectionAction} className="grid gap-4">
              <input type="hidden" name="tenantId" value={tenantId ?? ""} />
              <Field label="Nom"><TextInput name="name" required /></Field>
              <Field label="Provider"><TextInput name="provider" defaultValue="m365" required /></Field>
              <Field label="Tenant externe"><TextInput name="tenantIdExternal" /></Field>
              <Field label="Client ID"><TextInput name="clientId" /></Field>
              <Field label="Client secret"><TextInput name="clientSecret" /></Field>
              <Field label="Refresh token"><TextArea name="refreshToken" rows={3} /></Field>
              <Field label="Email compte"><TextInput name="accountEmail" /></Field>
              <Field label="Calendar ID par défaut"><TextInput name="defaultCalendarId" /></Field>
              <Field label="Timezone"><TextInput name="timezone" defaultValue="America/Toronto" /></Field>
              <Checkbox name="isActive" defaultChecked label="Connexion active" />
              <SaveButton />
            </form>
            <div className="space-y-4">
              {connections.map((connection) => (
                <div key={connection.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveCalendarConnectionAction} className="grid gap-4">
                    <input type="hidden" name="id" value={connection.id} />
                    <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                    <Field label="Nom"><TextInput name="name" defaultValue={connection.name} required /></Field>
                    <Field label="Provider"><TextInput name="provider" defaultValue={connection.provider} required /></Field>
                    <Field label="Tenant externe"><TextInput name="tenantIdExternal" defaultValue={connection.tenantExternalId} /></Field>
                    <Field label="Client ID"><TextInput name="clientId" defaultValue={connection.clientId} /></Field>
                    <Field label="Client secret"><TextInput name="clientSecret" defaultValue={connection.clientSecret} /></Field>
                    <Field label="Refresh token"><TextArea name="refreshToken" defaultValue={connection.refreshToken} rows={3} /></Field>
                    <Field label="Email compte"><TextInput name="accountEmail" defaultValue={connection.accountEmail} /></Field>
                    <Field label="Calendar ID par défaut"><TextInput name="defaultCalendarId" defaultValue={connection.defaultCalendarId} /></Field>
                    <Field label="Timezone"><TextInput name="timezone" defaultValue={connection.timezone} /></Field>
                    <Checkbox name="isActive" defaultChecked={connection.isActive} label="Connexion active" />
                    <SaveButton />
                  </form>
                  <form action={deleteCalendarConnectionAction} className="mt-3">
                    <input type="hidden" name="id" value={connection.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Ressources calendrier">
          <div className="grid gap-6 xl:grid-cols-[1fr,1.2fr]">
            <form action={saveCalendarResourceAction} className="grid gap-4">
              <input type="hidden" name="tenantId" value={tenantId ?? ""} />
              <Field label="Nom"><TextInput name="name" required /></Field>
              <Field label="Employé"><TextInput name="employeeName" /></Field>
              <Field label="Connexion"><Select name="connectionId" options={connectionOptions} required /></Field>
              <Field label="Calendar ID"><TextInput name="calendarId" required /></Field>
              <Field label="Adresse calendrier"><TextInput name="calendarAddress" /></Field>
              <Field label="Timezone"><TextInput name="timezone" defaultValue="America/Toronto" /></Field>
              <Field label="Notes booking"><TextArea name="bookingNotes" rows={3} /></Field>
              <Checkbox name="isActive" defaultChecked label="Ressource active" />
              <SaveButton />
            </form>
            <div className="space-y-4">
              {resources.map((resource) => (
                <div key={resource.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveCalendarResourceAction} className="grid gap-4">
                    <input type="hidden" name="id" value={resource.id} />
                    <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                    <Field label="Nom"><TextInput name="name" defaultValue={resource.name} required /></Field>
                    <Field label="Employé"><TextInput name="employeeName" defaultValue={resource.employeeName} /></Field>
                    <Field label="Connexion"><Select name="connectionId" defaultValue={resource.connectionId} options={connectionOptions} required /></Field>
                    <Field label="Calendar ID"><TextInput name="calendarId" defaultValue={resource.calendarId} required /></Field>
                    <Field label="Adresse calendrier"><TextInput name="calendarAddress" defaultValue={resource.calendarAddress} /></Field>
                    <Field label="Timezone"><TextInput name="timezone" defaultValue={resource.timezone} /></Field>
                    <Field label="Notes booking"><TextArea name="bookingNotes" defaultValue={resource.bookingNotes} rows={3} /></Field>
                    <Checkbox name="isActive" defaultChecked={resource.isActive} label="Ressource active" />
                    <SaveButton />
                  </form>
                  <form action={deleteCalendarResourceAction} className="mt-3">
                    <input type="hidden" name="id" value={resource.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Affectations service → ressource">
          <div className="grid gap-6 xl:grid-cols-[1fr,1.2fr]">
            <form action={saveBookingServiceResourceAction} className="grid gap-4">
              <Field label="Service"><Select name="bookingServiceId" options={serviceOptions} required /></Field>
              <Field label="Ressource"><Select name="calendarResourceId" options={resourceOptions} required /></Field>
              <Field label="Priorité"><TextInput name="priority" type="number" defaultValue="100" required /></Field>
              <Checkbox name="isActive" defaultChecked label="Affectation active" />
              <SaveButton />
            </form>
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div key={mapping.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <form action={saveBookingServiceResourceAction} className="grid gap-4">
                    <input type="hidden" name="id" value={mapping.id} />
                    <Field label="Service"><Select name="bookingServiceId" defaultValue={mapping.bookingServiceId} options={serviceOptions} required /></Field>
                    <Field label="Ressource"><Select name="calendarResourceId" defaultValue={mapping.calendarResourceId} options={resourceOptions} required /></Field>
                    <Field label="Priorité"><TextInput name="priority" type="number" defaultValue={mapping.priority} required /></Field>
                    <Checkbox name="isActive" defaultChecked={mapping.isActive} label="Affectation active" />
                    <SaveButton />
                  </form>
                  <form action={deleteBookingServiceResourceAction} className="mt-3">
                    <input type="hidden" name="id" value={mapping.id} />
                    <DeleteButton />
                  </form>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
