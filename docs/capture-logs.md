# Capturer les logs pour dépannage (pas de voix)

1. Ouvre un terminal dans le dossier du projet :
   ```powershell
   cd "c:\Cursor Project Folder\IVR IA\bz-voicebot-ari"
   ```

2. Lance le voicebot (avec plus de détails) :
   ```powershell
   $env:LOG_LEVEL="info"; npm start
   ```

3. **Sans raccrocher**, passe un appel vers le numéro qui pointe sur le voicebot.

4. Attends 10–15 secondes (écoute, parle un peu si tu veux).

5. Arrête le voicebot (Ctrl+C).

6. **Copie tout le texte du terminal** (depuis le démarrage jusqu’à l’arrêt) et colle-le dans la conversation (ou envoie le fichier si tu as redirigé vers un fichier).

Pour enregistrer dans un fichier :
```powershell
$env:LOG_LEVEL="info"; npm start 2>&1 | Tee-Object -FilePath voicebot-logs.txt
```
Puis envoie le contenu de `voicebot-logs.txt`.

## Ce qu’on regarde dans les logs

- **StasisStart** → l’appel arrive bien dans l’app.
- **Bridge + ExternalMedia ready** + **RTP target** → Asterisk est censé envoyer le RTP à l’IP:port indiqué.
- **RTP remote learned** → le RTP d’Asterisk arrive jusqu’au voicebot (sinon : pare-feu ou mauvaise IP).
- **VoicePipeline started** → le pipeline STT/TTS est démarré.
- **Playing TTS to RTP** → le message de bienvenue est envoyé au RTP.
- **RTP first packet sent to Asterisk** → le voicebot envoie bien de l’audio vers Asterisk (voix retour).

Si « RTP remote learned » n’apparaît jamais, le RTP n’atteint pas ton PC (vérifier pare-feu et MEDIA_SERVER_IP).
