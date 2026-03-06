import { publishRuntimeConfigAction, saveSettingAction } from "@/app/actions";
import { AdminShell, Section } from "@/components/admin-shell";
import { SaveButton, Select, TextInput } from "@/components/forms";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TTS_MODEL_OPTIONS = [
  { value: "aura-2-agathe-fr", label: "Agathe FR - feminine, claire, professionnelle" },
  { value: "aura-2-hector-fr", label: "Hector FR - masculine, posée, professionnelle" },
  { value: "aura-asteria-en", label: "Asteria EN - feminine anglais" },
];

const TTS_PROVIDER_OPTIONS = [
  { value: "deepgram", label: "Deepgram" },
  { value: "eleven_labs", label: "ElevenLabs" },
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

const REQUIRED_SETTINGS = [
  {
    id: "required-tts_provider",
    key: "tts_provider",
    label: "Provider TTS",
    value: "deepgram",
  },
  {
    id: "required-dg_agent_llm_model",
    key: "dg_agent_llm_model",
    label: "Modèle LLM de l'agent",
    value: "gpt-4o-mini",
  },
  {
    id: "required-dg_tts_model",
    key: "dg_tts_model",
    label: "Modèle TTS Deepgram",
    value: "aura-2-agathe-fr",
  },
  {
    id: "required-elevenlabs_model_id",
    key: "elevenlabs_model_id",
    label: "Modèle ElevenLabs",
    value: "eleven_turbo_v2_5",
  },
  {
    id: "required-elevenlabs_voice_id",
    key: "elevenlabs_voice_id",
    label: "Voice ID ElevenLabs",
    value: "",
  },
  {
    id: "required-elevenlabs_language",
    key: "elevenlabs_language",
    label: "Langue ElevenLabs",
    value: "fr",
  },
];

export default async function SettingsPage() {
  await requireAuth();
  const settings = await prisma.setting.findMany({ orderBy: { label: "asc" } });
  const editableSettings = [
    ...settings.filter((setting) => !setting.key.startsWith("runtime_")),
    ...REQUIRED_SETTINGS.filter((requiredSetting) => !settings.some((setting) => setting.key === requiredSetting.key)),
  ];
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
                {setting.key === "elevenlabs_voice_id" ? (
                  <p className="mt-1 text-xs text-slate-500">Nécessaire seulement si le provider TTS est `ElevenLabs`.</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                  {setting.key === "tts_provider" ? (
                    <Select name="value" defaultValue={setting.value} options={TTS_PROVIDER_OPTIONS} />
                  ) : setting.key === "dg_agent_llm_model" ? (
                    <Select name="value" defaultValue={setting.value} options={LLM_MODEL_OPTIONS} />
                  ) : setting.key === "dg_tts_model" ? (
                    <Select name="value" defaultValue={setting.value} options={TTS_MODEL_OPTIONS} />
                  ) : setting.key === "elevenlabs_language" ? (
                    <Select name="value" defaultValue={setting.value} options={ELEVENLABS_LANGUAGE_OPTIONS} />
                  ) : (
                    <TextInput name="value" defaultValue={setting.value} />
                  )}
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
