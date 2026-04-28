import { publishRuntimeConfigAction, saveSettingAction, syncFreepbxDirectoryAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { SaveButton, Select, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SettingSeed = {
  id: string;
  key: string;
  label: string;
  value: string;
};

const TTS_MODEL_OPTIONS = [
  { value: "aura-2-agathe-fr", label: "Agathe FR - feminine, claire, professionnelle" },
  { value: "aura-2-hector-fr", label: "Hector FR - masculine, posée, professionnelle" },
  { value: "aura-asteria-en", label: "Asteria EN - feminine anglais" },
];

const TTS_PROVIDER_OPTIONS = [
  { value: "eleven_labs", label: "ElevenLabs - recommandé pour une voix plus naturelle" },
  { value: "deepgram", label: "Deepgram - plus simple, mais souvent plus synthétique" },
];

const ELEVENLABS_MODEL_OPTIONS = [
  { value: "eleven_multilingual_v2", label: "Eleven Multilingual v2 - meilleur choix pour naturel + cohérence" },
  { value: "eleven_turbo_v2_5", label: "Eleven Turbo v2.5 - plus rapide, mais souvent un peu moins naturel" },
];

const LLM_MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "OpenAI gpt-4o-mini" },
  { value: "gpt-4.1-mini", label: "OpenAI gpt-4.1-mini" },
  { value: "gpt-4.1", label: "OpenAI gpt-4.1" },
];

const ELEVENLABS_LANGUAGE_OPTIONS = [
  { value: "fr", label: "fr" },
  { value: "multi", label: "multi" },
];

const YES_NO_OPTIONS = [
  { value: "false", label: "Non" },
  { value: "true", label: "Oui" },
];

const REQUIRED_SETTINGS: SettingSeed[] = [
  { id: "required-tts_provider", key: "tts_provider", label: "Provider TTS", value: "eleven_labs" },
  { id: "required-dg_agent_llm_model", key: "dg_agent_llm_model", label: "Modèle LLM de l'agent", value: "gpt-4o-mini" },
  { id: "required-dg_tts_model", key: "dg_tts_model", label: "Modèle TTS Deepgram", value: "aura-2-agathe-fr" },
  { id: "required-elevenlabs_model_id", key: "elevenlabs_model_id", label: "Modèle ElevenLabs", value: "eleven_multilingual_v2" },
  { id: "required-elevenlabs_voice_id", key: "elevenlabs_voice_id", label: "Voice ID ElevenLabs", value: "" },
  { id: "required-elevenlabs_language", key: "elevenlabs_language", label: "Langue ElevenLabs", value: "multi" },
];

const FREEPBX_API_SETTINGS: SettingSeed[] = [
  { id: "required-freepbx-directory-sync-enabled", key: "freepbx_directory_sync_enabled", label: "Activer la sync annuaire FreePBX", value: "false" },
  { id: "required-freepbx-api-base-url", key: "freepbx_api_base_url", label: "IP du serveur", value: "" },
  { id: "required-freepbx-api-token-url", key: "freepbx_api_token_url", label: "Token", value: "" },
  { id: "required-freepbx-api-graphql-url", key: "freepbx_api_graphql_url", label: "URL API", value: "" },
  { id: "required-freepbx-api-client-id", key: "freepbx_api_client_id", label: "Client ID API FreePBX", value: "" },
  { id: "required-freepbx-api-client-secret", key: "freepbx_api_client_secret", label: "Client Secret API FreePBX", value: "" },
  { id: "required-freepbx-directory-sync-interval-min", key: "freepbx_directory_sync_interval_min", label: "Intervalle de sync annuaire (minutes)", value: "60" },
  { id: "required-freepbx-directory-match-mode", key: "freepbx_directory_match_mode", label: "Mode de recherche annuaire", value: "contains" },
];

const FREEPBX_MATCH_MODE_OPTIONS = [
  { value: "contains", label: "Contient le nom" },
  { value: "starts_with", label: "Commence par" },
  { value: "strict", label: "Exact" },
];

function getSettingHelp(key: string) {
  switch (key) {
    case "elevenlabs_voice_id":
      return "Nécessaire si le provider TTS est ElevenLabs. C’est ce champ qui détermine concrètement la voix entendue.";
    case "elevenlabs_model_id":
      return "eleven_multilingual_v2 est le meilleur défaut pour viser une voix plus naturelle.";
    case "elevenlabs_language":
      return "multi est généralement le meilleur choix pour ne pas rigidifier l’accent.";
    case "freepbx_api_base_url":
      return "Entre l'IP ou le domaine du serveur FreePBX. Exemple : http://172.19.11.111";
    case "freepbx_api_token_url":
      return "URL du endpoint OAuth token FreePBX. Exemple : https://ton-pbx/admin/api/api/token";
    case "freepbx_api_graphql_url":
      return "URL GraphQL/API FreePBX. Exemple : https://ton-pbx/admin/api/api/gql";
    case "freepbx_api_client_id":
      return "Client ID généré dans l’application API/OAuth de FreePBX.";
    case "freepbx_api_client_secret":
      return "Secret OAuth associé au client API FreePBX.";
    case "freepbx_directory_sync_interval_min":
      return "60 = sync toutes les heures.";
    case "freepbx_directory_sync_enabled":
      return "Active la récupération automatique de l'annuaire quand la tâche de sync tourne.";
    case "freepbx_directory_match_mode":
      return "Détermine à quel point le nom prononcé doit coller au nom dans l’annuaire.";
    default:
      return null;
  }
}

function getInput(setting: { key: string; value: string }) {
  if (setting.key === "tts_provider") return <Select name="value" defaultValue={setting.value} options={TTS_PROVIDER_OPTIONS} />;
  if (setting.key === "dg_agent_llm_model") return <Select name="value" defaultValue={setting.value} options={LLM_MODEL_OPTIONS} />;
  if (setting.key === "dg_tts_model") return <Select name="value" defaultValue={setting.value} options={TTS_MODEL_OPTIONS} />;
  if (setting.key === "elevenlabs_model_id") return <Select name="value" defaultValue={setting.value} options={ELEVENLABS_MODEL_OPTIONS} />;
  if (setting.key === "elevenlabs_language") return <Select name="value" defaultValue={setting.value} options={ELEVENLABS_LANGUAGE_OPTIONS} />;
  if (setting.key === "freepbx_directory_sync_enabled") return <Select name="value" defaultValue={setting.value} options={YES_NO_OPTIONS} />;
  if (setting.key === "freepbx_directory_match_mode") return <Select name="value" defaultValue={setting.value} options={FREEPBX_MATCH_MODE_OPTIONS} />;
  return <TextInput name="value" defaultValue={setting.value} />;
}

function SettingCard({ setting }: { setting: { id: string; key: string; label: string; value: string } }) {
  const help = getSettingHelp(setting.key);

  return (
    <form action={saveSettingAction} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <input type="hidden" name="id" value={setting.id} />
      <input type="hidden" name="key" value={setting.key} />
      <input type="hidden" name="label" value={setting.label} />
      <div className="mb-3">
        <p className="text-sm font-semibold">{setting.label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-300/70">{setting.key}</p>
        {help ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{help}</p> : null}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">{getInput(setting)}</div>
        <SaveButton />
      </div>
    </form>
  );
}

export default async function SettingsPage() {
  await requireAuth();
  const settings = await prisma.setting.findMany({ orderBy: { label: "asc" } });
  const directoryCount = await prisma.directoryContact.count({ where: { isActive: true } });
  const visibleSettings = settings.filter((setting) => !setting.key.startsWith("runtime_"));

  const globalSettings = [
    ...visibleSettings.filter((setting) => !setting.key.startsWith("freepbx_")),
    ...REQUIRED_SETTINGS.filter((requiredSetting) => !settings.some((setting) => setting.key === requiredSetting.key)),
  ];

  const freepbxSettings = [
    ...visibleSettings.filter((setting) => setting.key.startsWith("freepbx_")),
    ...FREEPBX_API_SETTINGS.filter((requiredSetting) => !settings.some((setting) => setting.key === requiredSetting.key)),
  ];

  const lastPublishedAt = settings.find((setting) => setting.key === "runtime_last_published_at")?.value || null;
  const lastPublishedPath = settings.find((setting) => setting.key === "runtime_last_published_path")?.value || null;
  const lastDirectorySyncAt = settings.find((setting) => setting.key === "freepbx_directory_last_synced_at")?.value || null;
  const lastDirectorySyncCount = settings.find((setting) => setting.key === "freepbx_directory_last_synced_count")?.value || null;

  return (
    <AdminShell title="Paramètres" subtitle="Réglages de base du panneau d’administration et du comportement global." showPublishButton={true}>
      <Section title="Publication runtime" description="Publie la configuration active dans un fichier JSON partagé avec le voicebot.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-semibold">Fichier publié : `runtime/voicebot-config.json`</p>
              <p>Dernière publication : {lastPublishedAt ? new Date(lastPublishedAt).toLocaleString("fr-CA") : "Jamais"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-300/70">{lastPublishedPath ?? "Aucun chemin enregistré pour le moment."}</p>
            </div>
            <form action={publishRuntimeConfigAction}>
              <SaveButton label="Publier vers le voicebot" />
            </form>
          </div>
        </div>
      </Section>

      <Section title="Paramètres globaux" description="Ces paramètres servent de base à l’interface et au comportement du système.">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
          <p className="font-semibold">Réglage recommandé pour une voix québécoise plus naturelle</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900 dark:text-emerald-100/90">
            <li>`tts_provider` = `eleven_labs`</li>
            <li>`elevenlabs_model_id` = `eleven_multilingual_v2`</li>
            <li>`elevenlabs_language` = `multi`</li>
            <li>Renseigner un `elevenlabs_voice_id` qui sonne bien en français québécois</li>
          </ul>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-100/70">
            Si ElevenLabs n’est pas complètement configuré, le voicebot retombera automatiquement sur Deepgram.
          </p>
        </div>
        <div className="space-y-5">
          {globalSettings.map((setting) => (
            <SettingCard key={setting.id} setting={setting} />
          ))}
        </div>
      </Section>

      <Section title="Connexion API FreePBX" description="Prépare la connexion API pour une synchronisation de l’annuaire des utilisateurs/extensions.">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">
          <p className="font-semibold">Annuaire FreePBX</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-900 dark:text-sky-100/90">
            <li>OAuth Client Credentials</li>
            <li>GraphQL FreePBX</li>
            <li>Import local des noms + extensions</li>
            <li>Base pour transfert par nom depuis l’IVR</li>
          </ul>
        </div>
        <div className="mt-5 space-y-5">
          {freepbxSettings.map((setting) => (
            <SettingCard key={setting.id} setting={setting} />
          ))}
        </div>
      </Section>

      <Section title="Synchronisation annuaire" description="Importer les utilisateurs et extensions FreePBX dans une table locale pour le voicebot.">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-semibold">Contacts actifs importés : {directoryCount}</p>
              <p>Dernière sync : {lastDirectorySyncAt ? new Date(lastDirectorySyncAt).toLocaleString("fr-CA") : "Jamais"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-300/70">Dernier volume importé : {lastDirectorySyncCount ?? "0"}</p>
            </div>
            <form action={syncFreepbxDirectoryAction}>
              <SaveButton label="Synchroniser l’annuaire" />
            </form>
          </div>
        </div>
      </Section>
    </AdminShell>
  );
}
