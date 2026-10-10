#!/usr/bin/env bash
# Installation complète de Food-app sur le homelab : Supabase self-hosted + front, exposés via Tailscale Serve.
# Usage : bash install.sh [DOSSIER] [URL_PUBLIQUE]
#   DOSSIER       défaut /srv/docker/food-app (relancé automatiquement au boot par homelab-stacks.service)
#   URL_PUBLIQUE  défaut https://homelab-marsan.tail4c6e30.ts.net:8443
# Prérequis : Docker + compose, git, python3-yaml, jq, openssl, rsync, Tailscale ; utilisateur dans le groupe docker.
set -euo pipefail

BASE=${1:-/srv/docker/food-app}
PUBLIC_URL=${2:-https://homelab-marsan.tail4c6e30.ts.net:8443}
# Version de la config Docker officielle Supabase (supabase/supabase, dossier docker/)
SUPABASE_REF=8617532ae1a41571d5d557cd24c6f5f2565d9230
REPO_URL=https://github.com/NicolasMRSN/Food-app.git

mkdir -p "$BASE"
cd "$BASE"

echo "[1/6] Code de l'app (app-src/)"
[ -d app-src/.git ] || git clone -q "$REPO_URL" app-src

echo "[2/6] Fichiers Docker officiels Supabase ($SUPABASE_REF)"
if [ ! -f docker-compose.yml ]; then
  tmp=$(mktemp -d)
  git clone -q --filter=blob:none --no-checkout https://github.com/supabase/supabase.git "$tmp"
  git -C "$tmp" sparse-checkout set docker
  git -C "$tmp" checkout -q "$SUPABASE_REF"
  rsync -a "$tmp/docker/" "$BASE/"
  rm -rf "$tmp"
fi

echo "[3/6] Secrets et configuration (.env)"
if ! grep -q "^# food-app configured" .env 2>/dev/null; then
  cp .env.example .env
  chmod 600 .env
  sh utils/generate-keys.sh --update-env >/dev/null
  sh utils/add-new-auth-keys.sh --update-env >/dev/null
  setv() { sed -i "s|^$1=.*$|$1=$2|" .env; }
  setv COMPOSE_FILE compose.yaml
  setv SUPABASE_PUBLIC_URL "$PUBLIC_URL"
  setv API_EXTERNAL_URL "$PUBLIC_URL/auth/v1"
  setv SITE_URL "$PUBLIC_URL"
  setv ADDITIONAL_REDIRECT_URLS "$PUBLIC_URL/**"
  setv DISABLE_SIGNUP true
  setv ENABLE_EMAIL_AUTOCONFIRM true
  setv FUNCTIONS_VERIFY_JWT true
  setv API_GW_HTTP_PORT 127.0.0.1:8000
  setv DASHBOARD_USERNAME nicolas
  setv STUDIO_DEFAULT_ORGANIZATION Homelab
  setv STUDIO_DEFAULT_PROJECT Food-app
  rm -f .env.old docker-compose.yml.old
  echo "# food-app configured $(date -I)" >> .env
fi

echo "[4/6] Edge Functions + compose.yaml"
bash app-src/deploy/homelab/sync-functions.sh "$BASE"
python3 app-src/deploy/homelab/make-compose.py

echo "[5/6] Démarrage et base de données"
docker compose up -d --build
until [ "$(docker inspect -f '{{.State.Health.Status}}' supabase-db)" = healthy ]; do sleep 2; done
bash app-src/deploy/homelab/migrate.sh

echo "[6/6] Publication sur le tailnet (Tailscale Serve)"
port=${PUBLIC_URL##*:}
sudo tailscale serve --bg --https="$port" http://127.0.0.1:8081 >/dev/null
sudo tailscale serve --bg --https=10000 http://127.0.0.1:8000 >/dev/null

echo
echo "Food-app : $PUBLIC_URL"
echo "Studio   : ${PUBLIC_URL%:*}:10000 (utilisateur nicolas, mot de passe = DASHBOARD_PASSWORD dans $BASE/.env)"
