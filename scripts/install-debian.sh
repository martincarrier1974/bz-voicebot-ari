#!/bin/bash
# Installation du voicebot BZ sur Debian 12
# À lancer sur le serveur (même machine que FreePBX ou instance dédiée).
# Usage: sudo bash install-debian.sh

set -e
INSTALL_DIR="${INSTALL_DIR:-/opt/bz-voicebot-ari}"
REPO_URL="${REPO_URL:-https://github.com/martincarrier1974/bz-voicebot-ari.git}"

echo "=== BZ Voicebot - Installation Debian ==="
echo "Répertoire: $INSTALL_DIR"
echo ""

# Vérifier Node.js
if ! command -v node &>/dev/null; then
  echo "ERREUR: Node.js n'est pas installé. Installez-le avec:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt install -y nodejs"
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "ERREUR: Node.js 18+ requis (actuel: $(node -v))"
  exit 1
fi
echo "[OK] Node.js $(node -v)"

# Créer le répertoire et cloner ou mettre à jour
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "[OK] Projet déjà cloné dans $INSTALL_DIR, mise à jour..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "Clonage du dépôt..."
  sudo mkdir -p "$(dirname "$INSTALL_DIR")"
  if [ -d "$INSTALL_DIR" ]; then
    echo "Le répertoire $INSTALL_DIR existe déjà mais n'est pas un dépôt git."
    echo "Supprimez-le ou définissez INSTALL_DIR ailleurs."
    exit 1
  fi
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
  sudo chown -R "$(whoami):" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo "Installation des dépendances npm..."
npm install

# Déterminer si même machine que FreePBX (ARI en local)
echo ""
read -p "Le voicebot tourne-t-il sur la MÊME machine que FreePBX ? (o/n) [o]: " SAME_MACHINE
SAME_MACHINE="${SAME_MACHINE:-o}"

if [ "$SAME_MACHINE" = "o" ] || [ "$SAME_MACHINE" = "O" ] || [ "$SAME_MACHINE" = "y" ]; then
  ARI_URL="http://127.0.0.1:8088"
  MEDIA_SERVER_IP="127.0.0.1"
  ASTERISK_IP="127.0.0.1"
else
  read -p "IP du serveur FreePBX (ex: 172.19.11.111): " ASTERISK_IP
  ARI_URL="http://${ASTERISK_IP}:8088"
  read -p "IP de CETTE machine (pour MEDIA_SERVER_IP, ex: 172.25.107.80): " MEDIA_SERVER_IP
fi

read -p "ARI_USER [bztelecom]: " ARI_USER
ARI_USER="${ARI_USER:-bztelecom}"
read -sp "ARI_PASS: " ARI_PASS
echo ""
read -sp "DEEPGRAM_API_KEY: " DEEPGRAM_API_KEY
echo ""

# Créer .env
cat > .env << EOF
# Généré par install-debian.sh
ARI_URL=$ARI_URL
ARI_USER=$ARI_USER
ARI_PASS=$ARI_PASS
ARI_APP=voicebot
ASTERISK_PUBLIC_IP=$ASTERISK_IP
RTP_LISTEN_PORT=5176
MEDIA_SERVER_IP=$MEDIA_SERVER_IP
DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY
DG_STT_MODEL=nova-2
DG_TTS_MODEL=aura-asteria-en
EOF

echo ""
echo "[OK] Fichier .env créé."

# Service systemd
read -p "Installer le service systemd (démarrage auto) ? (o/n) [o]: " INSTALL_SVC
INSTALL_SVC="${INSTALL_SVC:-o}"

if [ "$INSTALL_SVC" = "o" ] || [ "$INSTALL_SVC" = "O" ] || [ "$INSTALL_SVC" = "y" ]; then
  SVC_USER="${SUDO_USER:-$USER}"
  if [ "$SVC_USER" = "root" ] && [ -n "$SUDO_USER" ]; then
    SVC_USER="$SUDO_USER"
  fi
  cat > /tmp/bz-voicebot.service << EOF
[Unit]
Description=BZ Voicebot ARI
After=network.target

[Service]
Type=simple
User=$SVC_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(command -v node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  sudo mv /tmp/bz-voicebot.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable bz-voicebot
  echo "[OK] Service systemd installé et activé."
  echo "    Démarrer: sudo systemctl start bz-voicebot"
  echo "    Statut:   sudo systemctl status bz-voicebot"
  echo "    Logs:     journalctl -u bz-voicebot -f"
else
  echo "Pour lancer manuellement: cd $INSTALL_DIR && npm start"
fi

echo ""
echo "=== Installation terminée ==="
echo "Répertoire: $INSTALL_DIR"
echo "Pour modifier la config: nano $INSTALL_DIR/.env"
