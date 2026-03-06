# Contrat runtime voicebot

Le projet utilise maintenant deux objets distincts.

## 1. Configuration publiée

La configuration publiée est un JSON statique généré par `apps/admin` puis écrit dans `runtime/voicebot-config.json`.

Elle contient notamment :

- `version`
- `generatedAt`
- `companyName`
- `prompts`
- `settings`
- `context`
- `routes`
- `flows`

Cette structure représente le contrat `PublishedVoicebotConfig`.

Fichier de référence :

- `apps/admin/src/types/voicebot-runtime.ts`

## 2. État de session d'appel

L'état de session est un objet volatile créé pour chaque appel.

Il contient notamment :

- `session`
- `audio`
- `nlu`
- `flow`
- `history`
- `flags`
- `metadata`

Cette structure représente le contrat `CallRuntimeState`.

Fichiers de référence :

- `apps/admin/src/types/voicebot-runtime.ts`
- `src/runtime/callRuntime.js`

## Règle importante

Ne pas mélanger la configuration métier publiée et l'état d'un appel en cours.

- La config publiée décrit comment le voicebot doit se comporter.
- L'état de session décrit ce qui se passe pendant un appel précis.
