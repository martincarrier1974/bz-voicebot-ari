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

## Scripts

| Script   | Description                |
|----------|----------------------------|
| `npm run dev`   | Run with `--watch` (restart on file change) |
| `npm start`     | Run once                   |
| `npm run lint`  | ESLint                     |
| `npm run format`| Prettier                   |
