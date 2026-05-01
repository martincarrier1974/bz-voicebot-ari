import { AdminShell, Section } from "@/components/admin-shell";
import { Field, SaveButton, TextInput } from "@/components/forms";
import { publishRuntimeConfigAction, saveSettingAction, syncFreepbxDirectoryAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantContext, getRuntimeConfigPathForTenant } from "@/lib/tenant";

const DEFAULT_SETTINGS = [
  ["company_name", "Nom entreprise"],
  ["freepbx_directory_sync_enabled", "Sync annuaire FreePBX activée"],
  ["freepbx_api_base_url", "FreePBX base URL"],
  ["freepbx_api_token_url", "FreePBX token URL"],
  ["freepbx_api_graphql_url", "FreePBX GraphQL URL"],
  ["freepbx_api_client_id", "FreePBX client ID"],
  ["freepbx_api_client_secret", "FreePBX client secret"],
  ["freepbx_directory_sync_interval_min", "Intervalle sync FreePBX (min)"],
  ["freepbx_directory_match_mode", "Mode matching annuaire"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ tenantId?: string }> }) {
  await requireAuth();
  const { tenants, currentTenant, tenantId } = await getTenantContext(searchParams);
  const settings = tenantId ? await prisma.setting.findMany({ where: { tenantId }, orderBy: { label: "asc" } }) : [];
  const settingsMap = new Map(settings.map((setting) => [setting.key, setting]));
  const runtimePath = currentTenant ? getRuntimeConfigPathForTenant(currentTenant) : null;

  return (
    <AdminShell title="Paramètres" subtitle="Paramètres et publication runtime par client" tenants={tenants} currentTenant={currentTenant}>
      <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
        <Section title="Paramètres client">
          <div className="space-y-4">
            {DEFAULT_SETTINGS.map(([key, label]) => {
              const setting = settingsMap.get(key);
              return (
                <form key={key} action={saveSettingAction} className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <input type="hidden" name="tenantId" value={tenantId ?? ""} />
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="label" value={label} />
                  <Field label={label}><TextInput name="value" defaultValue={setting?.value ?? ""} /></Field>
                  <SaveButton />
                </form>
              );
            })}
          </div>
        </Section>

        <Section title="Opérations runtime">
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <p className="font-semibold">Chemin de publication</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300/80">{runtimePath ?? "Aucun client"}</p>
            </div>
            <form action={publishRuntimeConfigAction}>
              <input type="hidden" name="tenantId" value={tenantId ?? ""} />
              <SaveButton label="Publier la config runtime" />
            </form>
            <form action={syncFreepbxDirectoryAction}>
              <input type="hidden" name="tenantId" value={tenantId ?? ""} />
              <SaveButton label="Synchroniser l’annuaire FreePBX" />
            </form>
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}
