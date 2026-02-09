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
- `src/utils/` — Logger (pino)
- `src/ai/` — (TODO) Voice AI streaming integration

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
