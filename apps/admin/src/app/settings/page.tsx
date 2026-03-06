import { saveSettingAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { SaveButton, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  await requireAuth();
  const settings = await prisma.setting.findMany({ orderBy: { label: "asc" } });

  return (
    <AdminShell title="Paramètres" subtitle="Réglages de base du panneau d’administration et du comportement global.">
      <Section title="Paramètres globaux" description="Ces paramètres servent de base à l’interface et au comportement du système.">
        <div className="space-y-5">
          {settings.map((setting) => (
            <form key={setting.id} action={saveSettingAction} className="rounded-2xl border border-slate-200 p-4">
              <input type="hidden" name="id" value={setting.id} />
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="label" value={setting.label} />
              <div className="mb-3">
                <p className="text-sm font-semibold">{setting.label}</p>
                <p className="text-xs text-slate-500">{setting.key}</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  <TextInput name="value" defaultValue={setting.value} />
                </div>
                <SaveButton />
              </div>
            </form>
          ))}
        </div>
      </Section>
    </AdminShell>
  );
}
