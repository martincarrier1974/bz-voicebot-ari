import { publishRuntimeConfigAction, saveSettingAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { SaveButton, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  await requireAuth();
  const settings = await prisma.setting.findMany({ orderBy: { label: "asc" } });
  const editableSettings = settings.filter((setting) => !setting.key.startsWith("runtime_"));
  const lastPublishedAt = settings.find((setting) => setting.key === "runtime_last_published_at")?.value || null;
  const lastPublishedPath = settings.find((setting) => setting.key === "runtime_last_published_path")?.value || null;

  return (
    <AdminShell title="Paramètres" subtitle="Réglages de base du panneau d’administration et du comportement global.">
      <Section
        title="Publication runtime"
        description="Publie la configuration active dans un fichier JSON partagé avec le voicebot."
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm text-slate-700">
              <p className="font-semibold">Fichier publié : `runtime/voicebot-config.json`</p>
              <p>
                Dernière publication : {lastPublishedAt ? new Date(lastPublishedAt).toLocaleString("fr-CA") : "Jamais"}
              </p>
              <p className="text-xs text-slate-500">{lastPublishedPath ?? "Aucun chemin enregistré pour le moment."}</p>
            </div>
            <form action={publishRuntimeConfigAction}>
              <SaveButton label="Publier vers le voicebot" />
            </form>
          </div>
        </div>
      </Section>

      <Section title="Paramètres globaux" description="Ces paramètres servent de base à l’interface et au comportement du système.">
        <div className="space-y-5">
          {editableSettings.map((setting) => (
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
