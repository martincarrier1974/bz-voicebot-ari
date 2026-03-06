# Installation du voicebot sur Debian 12

Guide pour faire tourner le voicebot sur une instance Linux (Debian 12), dans le même environnement que ton FreePBX ou sur un serveur dédié.

---

## 1. Prérequis

- Une machine Debian 12 (VM ou physique) avec accès réseau à ton FreePBX (172.19.11.111).
- Accès root ou sudo.

---

## 2. Mise à jour et paquets de base

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git
```

---

## 3. Installer Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Vérifier :

```bash
node -v   # v20.x.x
npm -v    # 10.x.x
```

---

## 4. Installer le projet

### Option A : cloner depuis GitHub

```bash
sudo mkdir -p /opt
sudo chown "$USER:$USER" /opt
cd /opt
git clone https://github.com/martincarrier1974/bz-voicebot-ari.git
cd bz-voicebot-ari
npm install
```

### Option B : copier le projet depuis ton PC

Sur ton PC (PowerShell), depuis le dossier du projet :

```powershell
scp -r "c:\Cursor Project Folder\IVR IA\bz-voicebot-ari" user@IP_DEBIAN:/opt/
```

Puis sur la Debian :

```bash
cd /opt/bz-voicebot-ari
npm install
```

---

## 5. Fichier `.env`

Créer le fichier de configuration :

```bash
cd /opt/bz-voicebot-ari
cp .env.example .env
nano .env
```

Renseigner selon ton cas :

### Cas 1 : Voicebot sur le **même serveur** que FreePBX (même machine qu’Asterisk)

```env
ARI_URL=http://127.0.0.1:8088
ARI_USER=bztelecom
ARI_PASS=ton_mot_de_passe_ari
ARI_APP=voicebot
ASTERISK_PUBLIC_IP=172.19.11.111
RTP_LISTEN_PORT=5176
MEDIA_SERVER_IP=127.0.0.1
DEEPGRAM_API_KEY=ta_cle_deepgram
DG_STT_MODEL=nova-2
DG_TTS_MODEL=aura-asteria-en
```

Ici, **MEDIA_SERVER_IP=127.0.0.1** : le RTP reste en local, aucun pare-feu à gérer entre machines.

### Cas 2 : Voicebot sur une **autre machine** que FreePBX (instance Debian séparée)

Remplace `IP_DEBIAN` par l’IP réelle de ta Debian (celle que FreePBX peut joindre).

```env
ARI_URL=http://172.19.11.111:8088
ARI_USER=bztelecom
ARI_PASS=ton_mot_de_passe_ari
ARI_APP=voicebot
ASTERISK_PUBLIC_IP=172.19.11.111
RTP_LISTEN_PORT=5176
MEDIA_SERVER_IP=IP_DEBIAN
DEEPGRAM_API_KEY=ta_cle_deepgram
DG_STT_MODEL=nova-2
DG_TTS_MODEL=aura-asteria-en
```

Sur cette Debian, ouvrir le port **UDP 5176** en entrée (voir section 8).

Sauvegarder : `Ctrl+O`, Entrée, `Ctrl+X`.

---

## 6. Lancer le voicebot (test)

```bash
cd /opt/bz-voicebot-ari
npm start
```

Tu dois voir par exemple : `RTP server listening`, `ARI Voicebot started`. Passer un appel pour vérifier la voix.

Arrêter : `Ctrl+C`.

---

## 7. Lancer au démarrage avec systemd (optionnel)

Pour que le voicebot tourne en permanence et redémarre après un reboot :

```bash
sudo nano /etc/systemd/system/bz-voicebot.service
```

Contenu :

```ini
[Unit]
Description=BZ Voicebot ARI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bz-voicebot-ari
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Si tu as installé le projet avec un autre utilisateur, remplace `User=root` par cet utilisateur.

Activer et démarrer :

```bash
sudo systemctl daemon-reload
sudo systemctl enable bz-voicebot
sudo systemctl start bz-voicebot
sudo systemctl status bz-voicebot
```

Logs :

```bash
journalctl -u bz-voicebot -f
```

---

## 8. Pare-feu (si voicebot sur une machine différente de FreePBX)

Sur la Debian, si tu utilises `ufw` :

```bash
# Autoriser SSH si tu es en remote
sudo ufw allow 22/tcp
# RTP entrant pour Asterisk -> voicebot
sudo ufw allow 5176/udp
sudo ufw enable
sudo ufw status
```

Si le voicebot est sur la **même** machine que FreePBX, tu n’as pas besoin d’ouvrir 5176 vers l’extérieur (RTP en localhost).

---

## 9. Récapitulatif

| Étape | Commande / action |
|-------|-------------------|
| Mise à jour | `sudo apt update && sudo apt upgrade -y` |
| Node.js 20 | NodeSource `setup_20.x` puis `apt install nodejs` |
| Projet | `git clone` dans `/opt/bz-voicebot-ari` puis `npm install` |
| Config | Copier `.env.example` vers `.env`, remplir (dont `MEDIA_SERVER_IP`) |
| Test | `npm start` puis appel test |
| Service | Optionnel : unit systemd `bz-voicebot.service` |
| Pare-feu | Si machine dédiée : `ufw allow 5176/udp` |

---

## Dépannage

- **Pas de voix** : vérifier que `MEDIA_SERVER_IP` est bien l’IP de la machine où tourne le voicebot (ou `127.0.0.1` si même machine que FreePBX). Voir `docs/depannage-audio.md`.
- **Connexion ARI refusée** : vérifier `ARI_URL`, utilisateur/mot de passe, et que le port TCP 8088 est accessible depuis la Debian vers FreePBX.
- **Logs** : `journalctl -u bz-voicebot -f` ou en direct avec `npm start`.
