import Link from "next/link";
import { AdminShell, Card, Section } from "@/components/admin-shell";
import { requireAuth } from "@/lib/auth";
import { readLiveCallsSnapshot } from "@/lib/live-calls";

export const dynamic = "force-dynamic";

export default async function LiveCallsPage() {
  await requireAuth();

  const snapshot = readLiveCallsSnapshot();
  const lastUpdated = snapshot.count > 0 ? new Date(snapshot.updatedAt).toLocaleString("fr-CA") : "Aucune activité récente";

  return (
    <AdminShell
      title="Appels en direct"
      subtitle="Vue en temps réel de l’état mémoire des appels gérés par le voicebot."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Appels actifs" value={snapshot.count} hint="Sessions actuellement suivies par le voicebot" />
        <Card title="Dernière mise à jour" value={snapshot.count > 0 ? "Live" : "Idle"} hint={lastUpdated} />
        <Card title="Historique chargé" value={snapshot.calls.reduce((sum, call) => sum + call.history.length, 0)} hint="Messages mémorisés dans les sessions actives" />
      </div>

      <div className="mt-6">
        <Section
          title="État des sessions"
          description="Recharge la page pour voir les derniers événements enregistrés dans le fichier runtime partagé."
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">Dernière lecture : {lastUpdated}</p>
            <Link
              href={`/live-calls?refresh=${snapshot.updatedAt}`}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              Rafraîchir
            </Link>
          </div>

          {snapshot.calls.length > 0 ? (
            <div className="space-y-4">
              {snapshot.calls.map((call) => (
                <div key={call.session.callId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Info title="Call ID" value={call.session.callId} />
                    <Info title="Étape" value={call.flow.currentStep} />
                    <Info title="Intention" value={call.nlu.currentIntent} />
                    <Info title="Cible transfert" value={call.flow.transferTarget} />
                    <Info title="Relances" value={`${call.flow.retryCount} / ${call.flow.maxRetries}`} />
                    <Info title="Écoute / parole" value={`${call.audio.isListening ? "écoute" : "pause"} / ${call.audio.isSpeaking ? "parle" : "silence"}`} />
                    <Info title="Clarification" value={call.nlu.needsClarification ? "Oui" : "Non"} />
                    <Info title="Debug" value={call.flags.debugMode ? "Actif" : "Off"} />
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">Historique récent</p>
                      <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                        {call.history.length > 0 ? (
                          call.history.slice(-8).map((entry, index) => (
                            <div key={`${call.session.callId}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">{String(entry.role || "event")}: </span>
                              {String(entry.text || "")}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Aucun message enregistré pour cette session.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">Métadonnées</p>
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
                          {JSON.stringify(call.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun appel actif détecté. Lance un appel puis rafraîchis cette page.</p>
          )}
        </Section>
      </div>
    </AdminShell>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
