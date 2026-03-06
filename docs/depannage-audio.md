# Dépannage : appel en cours mais pas de voix

## 1. Où tourne le voicebot (Node) ?

- **Sur le même serveur qu’Asterisk/FreePBX**  
  → `MEDIA_SERVER_IP` = IP de ce serveur (ex. `172.25.107.80`). OK dans ton `.env` si c’est le cas.

- **Sur un autre PC (ex. ton poste Windows)**  
  → `MEDIA_SERVER_IP` doit être **l’IP de ce PC**, telle que vue depuis Asterisk (ex. `192.168.1.50`).  
  Si tu laisses `172.25.107.80`, Asterisk envoie le RTP vers le serveur FreePBX, pas vers ton PC → pas d’audio.

## 2. Vérifier les logs pendant un appel

Lance le voicebot puis passe un appel. Dans le terminal, tu dois voir **dans l’ordre** :

1. `StasisStart`
2. `Bridge + ExternalMedia ready` + `externalHost: ...`
3. **`RTP remote learned`** ← si tu ne vois pas ça, le RTP n’arrive pas au Node (IP ou pare-feu).
4. `VoicePipeline started`
5. `Playing TTS to RTP` (message de bienvenue)

- Si **jamais** « RTP remote learned » : Asterisk n’envoie pas le RTP au bon endroit ou le port est bloqué (voir ci‑dessous).
- Si « RTP remote learned » apparaît mais pas de voix à l’écoute : le RTP retour (Node → Asterisk) peut être bloqué (pare-feu sur le PC qui fait tourner Node).

## 3. Ports et FreePBX

- **RTP range FreePBX (45200–45399)** : ce sont les ports qu’Asterisk utilise **de son côté** pour le RTP. Tu n’as rien à changer dans le voicebot pour ça. Asterisk enverra le RTP **vers** ton PC (MEDIA_SERVER_IP + RTP_LISTEN_PORT).
- **RTP_LISTEN_PORT** (ex. 5176) : port UDP sur lequel le voicebot **écoute** sur ton PC. Asterisk doit pouvoir envoyer des paquets **vers** ton PC:5176. Tu peux mettre 5176 (ou 40000) dans le `.env` selon ce que ton pare-feu autorise.

## 4. Pare-feu (port UDP du voicebot)

Sur la machine où tu lances `npm start` (ton PC) :

- **Windows** : autoriser le port **UDP** utilisé par le voicebot (ex. **5176** si `RTP_LISTEN_PORT=5176`) en **entrée**, depuis l’IP d’Asterisk (172.19.11.111) si possible, ou en entrée tout court.
- **Linux (serveur)** : `sudo ufw allow 5176/udp` (ou le port configuré), puis recharger.

## 5. Résumé des variables

| Variable            | Rôle |
|---------------------|------|
| `MEDIA_SERVER_IP`   | IP où Asterisk envoie le RTP = **obligatoirement l’IP de la machine qui exécute le voicebot** (accessible depuis Asterisk). |
| `RTP_LISTEN_PORT`   | Port UDP sur lequel Node écoute (ex. 5176 ou 40000). Ce port doit être ouvert en entrée sur la machine Node (pare-feu). |

## 6. Test avec plus de logs

Pour voir les paquets RTP reçus :

```bash
set LOG_LEVEL=debug
npm start
```

Puis rappeler : tu devrais voir beaucoup de logs RTP. Si même en `debug` tu n’as jamais « RTP remote learned », le RTP n’atteint pas Node.
