# BZ VoiceBot (Asterisk ARI + ExternalMedia + M365)

## Quick start

1. Copy env
```bash
cp .env.example .env
```

2. Edit `.env` with your ARI credentials, M365 app registration (if using calendar), and optional Voice AI key.

3. Install dependencies (if not already done)
```bash
npm install
```

4. Run
```bash
npm run dev
```
or `npm start`.

## Requirements

- Node.js 18+
- Asterisk with ARI and HTTP server enabled, and an Stasis app named as in `ARI_APP`.
- For calendar features: Microsoft 365 app registration with Graph permissions (Calendars.ReadWrite, User.Read).

## Project structure

- `src/ari/` — ARI client, Stasis events, bridge + ExternalMedia channel setup
- `src/media/` — RTP server (UDP) receiving/sending audio to Asterisk
- `src/calendar/` — M365 Graph (getSchedule, createEvent) and service → mailbox routing
- `src/config/` — Env validation (Zod)
- `src/runtime/` — état volatile d'un appel en cours
- `src/utils/` — Logger (pino)
- `src/ai/` — (TODO) Voice AI streaming integration
- `runtime/voicebot-config.json` — configuration publiée par `apps/admin` et lue par le voicebot
- `runtime/live-calls.json` — instantané des appels actifs pour l'admin
- `docs/runtime-contract.md` — séparation entre config publiée et état de session

## Admin -> Voicebot runtime

Le panneau `apps/admin` peut maintenant publier une configuration partagée dans `runtime/voicebot-config.json`.

- Depuis l’admin web, ouvre `Paramètres` puis clique sur `Publier vers le voicebot`.
- Le voicebot relit ce fichier au début de chaque nouvel appel.
- Les éléments publiés incluent les prompts actifs, le flow principal, le contexte, les routes et les intentions.

### Variable d’environnement

```bash
RUNTIME_CONFIG_PATH=runtime/voicebot-config.json
```

Par défaut, aucune action supplémentaire n’est requise après une publication si le voicebot tourne déjà avec cette version du code.

## Tester depuis Asterisk

Pour que l’appel atteigne le voicebot, Asterisk doit envoyer le canal en **Stasis** vers l’app nommée comme `ARI_APP` (par défaut `voicebot`).

### 1. Démarrer le voicebot

Sur la machine où tourne le serveur Node (accessible depuis Asterisk pour ARI + RTP) :

```bash
npm start
```

Tu dois voir par exemple : `RTP server listening`, `ARI Voicebot started`.

### 2. Configurer le dialplan

**Option A – Asterisk (extensions.conf)**  
Envoie l’appel vers Stasis puis raccroche à la fin (pour un test simple) :

```ini
; Exemple : extension 8500 envoie vers le voicebot
exten => 8500,1,Answer()
same => n,Stasis(voicebot)
same => n,Hangup()
```

Remplace `voicebot` si tu as changé `ARI_APP` dans le `.env`. Recharge le dialplan : `asterisk -rx "dialplan reload"`.

**Option B – FreePBX**  
1. **Applications** → **Custom Destinations** : crée une destination “Voicebot” avec comme destination `custom-voicebot,1,1` (ou le contexte que tu utilises).  
2. Dans **Custom Extensions** (ou le fichier custom du dialplan), ajoute par exemple :

```ini
[custom-voicebot]
exten => s,1,Answer()
same => n,Stasis(voicebot)
same => n,Hangup()
```

3. Utilise cette destination dans une **Inbound Route** (numéro entrant) ou dans un **IVR / Ring Group** pour qu’en composant ce numéro l’appel aille au voicebot.

### 3. Passer un appel test

- Depuis un téléphone branché sur Asterisk/FreePBX : compose l’extension (ex. **8500**) ou le numéro configuré en Inbound Route.
- L’appel doit être répondu, tu entendras le tone de bienvenue puis le voicebot (Deepgram). Dans les logs du voicebot tu dois voir un `StasisStart`, puis `Bridge + ExternalMedia ready`, puis `RTP remote learned`.

Si tu ne vois aucun log à l’appel, le dialplan n’envoie pas encore le canal en Stasis : revérifier l’extension / la route et que `Stasis(voicebot)` est bien exécuté.

## Logs et dépannage

Après relance, quand tu appelles, tu dois voir dans les logs :

1. **Bridge + ExternalMedia ready** (ARI / voicebot)
2. Puis dans `rtpServer.js` : **RTP remote learned**
3. Ensuite plein de **RTP packet** (si `LOG_LEVEL=debug`)

**Si tu vois StasisStart mais pas « RTP remote learned »**, ça veut dire :

- `external_host` pointe vers la mauvaise IP, ou
- le port UDP 40000 est bloqué (pare-feu / NAT), ou
- Asterisk n’arrive pas à joindre le serveur Node.

À vérifier : `ASTERISK_PUBLIC_IP` et `RTP_LISTEN_PORT` dans `.env` doivent correspondre à l’IP:port où le serveur Node écoute et qui est **atteignable depuis Asterisk**.

## Déploiement : GitHub + Railway

### 1. Pousser le code sur GitHub

Le dépôt Git est déjà initialisé et le premier commit est fait. Il reste à créer le dépôt sur GitHub et à pousser.

1. Va sur [github.com/new](https://github.com/new).
2. Nom du dépôt : `bz-voicebot-ari` (ou autre).
3. Ne coche pas « Add a README » (tu en as déjà un).
4. Crée le dépôt.

Puis dans le dossier du projet :

```powershell
cd "c:\Cursor Project Folder\IVR IA\bz-voicebot-ari"

# Remplace TON_USERNAME par ton identifiant GitHub
git remote add origin https://github.com/TON_USERNAME/bz-voicebot-ari.git

git push -u origin main
```

(Si ton dépôt s’appelle autrement, adapte l’URL et le nom de branche si besoin.)

### 2. Déployer sur Railway

1. Va sur [railway.app](https://railway.app) et connecte-toi (avec GitHub).
2. **New Project** → **Deploy from GitHub repo** → choisis le dépôt `bz-voicebot-ari`.
3. Railway détecte Node.js et utilise `npm start` automatiquement.
4. Dans le projet Railway, ouvre ton service → **Variables** et ajoute les variables d’environnement (comme dans `.env`) :
   - `ARI_URL`, `ARI_USER`, `ARI_PASS`, `ARI_APP`
   - `RTP_LISTEN_IP`, `RTP_LISTEN_PORT`, `ASTERISK_PUBLIC_IP`, `RTP_FORMAT`, `SAMPLE_RATE`, `TIMEZONE`
   - M365 et calendriers si tu les utilises.
5. **Deploy** : Railway build et lance l’app.

**Important (RTP)** : ce voicebot écoute de l’**UDP** (port 40000) pour l’audio. Railway expose surtout du HTTP. Pour que l’audio passe, soit :
- tu déploies le voicebot sur une machine/VPS qui a une IP fixe et un port UDP ouvert (recommandé pour Asterisk),  
- soit tu vérifies si ton plan Railway permet d’exposer des ports UDP et tu configures `ASTERISK_PUBLIC_IP` avec l’IP publique du service Railway.

---

## Scripts

| Script   | Description                |
|----------|----------------------------|
| `npm run dev`   | Run with `--watch` (restart on file change) |
| `npm start`     | Run once                   |
| `npm run lint`  | ESLint                     |
| `npm run format`| Prettier                   |
