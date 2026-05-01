# Contrat runtime voicebot

Le projet utilise maintenant deux objets distincts.

## 1. Configuration publiée

La configuration publiée est un JSON statique généré par `apps/admin`.

En mode multi-client, elle est écrite par défaut dans :

- `runtime/tenants/<slug>/voicebot-config.json`

Exemple :

- `runtime/tenants/bz-telecom/voicebot-config.json`
- `runtime/tenants/clinique-alpha/voicebot-config.json`

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

## 3. Live calls par client

Chaque runtime client écrit son propre snapshot d'appels actifs dans le même dossier que sa config publiée :

- `runtime/tenants/<slug>/live-calls.json`

L'admin lit donc les appels actifs selon le client sélectionné.

## 4. Résolution côté runtime Node

Le runtime charge sa config avec cette règle :

1. `RUNTIME_CONFIG_PATH` si défini explicitement
2. sinon `RUNTIME_TENANT` -> `runtime/tenants/<slug>/voicebot-config.json`
3. sinon fallback historique -> `runtime/voicebot-config.json`

## Règle importante

Ne pas mélanger la configuration métier publiée et l'état d'un appel en cours.

- La config publiée décrit comment le voicebot doit se comporter.
- L'état de session décrit ce qui se passe pendant un appel précis.
