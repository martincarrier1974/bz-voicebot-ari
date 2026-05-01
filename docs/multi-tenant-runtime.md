# Exploitation multi-client

## Modèle retenu

- une admin centrale
- un runtime Node séparé par client
- une runtime config publiée par client
- un ARI_APP distinct par client

## Convention recommandée

Pour un client `clinique-alpha` :

- `Tenant.slug` = `clinique-alpha`
- `RUNTIME_TENANT=clinique-alpha`
- `ARI_APP=voicebot-clinique-alpha`
- runtime config = `runtime/tenants/clinique-alpha/voicebot-config.json`
- live calls = `runtime/tenants/clinique-alpha/live-calls.json`
- fichier env = `deploy/env/clinique-alpha.env`
- process PM2 = `voicebot-clinique-alpha`

## Démarrage PM2

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs voicebot-bz-telecom
```

## Ajouter un nouveau client

1. créer le client dans l'admin
2. publier sa config runtime
3. copier `deploy/env/client.env.example` vers `deploy/env/<slug>.env`
4. définir au minimum :
   - `RUNTIME_TENANT=<slug>`
   - `ARI_APP=voicebot-<slug>`
   - `ARI_URL`, `ARI_USER`, `ARI_PASS`
5. ajouter une app PM2 dans `ecosystem.config.cjs`
6. créer le contexte FreePBX / dialplan pointant sur `Stasis(voicebot-<slug>)`
7. démarrer/recharger PM2

## Validation rapide

```bash
RUNTIME_TENANT=clinique-alpha ARI_USER=test ARI_PASS=test node --input-type=module -e "import('./src/config/env.js').then(({env}) => console.log(env.RUNTIME_CONFIG_PATH))"
```

Résultat attendu :

```bash
runtime/tenants/clinique-alpha/voicebot-config.json
```


## Option systemd (recommandée sur ce serveur)

Le serveur actuel utilise déjà `systemd` et **PM2 n'est pas installé**.

Template fourni dans le repo :

- `deploy/systemd/bz-voicebot@.service`

Exemple d'installation pour `bz-telecom` :

```bash
cp deploy/systemd/bz-voicebot@.service /etc/systemd/system/bz-voicebot@.service
systemctl daemon-reload
systemctl enable bz-voicebot@bz-telecom
systemctl start bz-voicebot@bz-telecom
systemctl status bz-voicebot@bz-telecom
```

Le service lira automatiquement :

- `deploy/env/bz-telecom.env`
