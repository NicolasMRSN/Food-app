#!/usr/bin/env bash
# Installation complète de Food-app sur le homelab : Supabase self-hosted + front, publiés sur le réseau local.
# Usage : bash install.sh [DOSSIER]
#   DOSSIER  défaut /srv/docker/food-app (relancé automatiquement au boot par homelab-stacks.service)
# L'adresse publiée est l'IP locale du serveur (http://IP:8081) ; homelab-reseau.sh la met à jour si la box change.
# Prérequis : Docker + compose, git, python3-yaml, jq, openssl, rsync ; utilisateur dans le groupe docker.
set -euo pipefail

BASE=${1:-/srv/docker/food-app}
IFACE=$(ip -4 route show default | awk '{print $5; exit}')
LAN_IP=$(ip -4 -o addr show dev "$IFACE" scope global | awk '{print $4; exit}' | cut -d/ -f1)
PUBLIC_URL=http://$LAN_IP:8081
# Version de la config Docker officielle Supabase (supabase/supabase, dossier docker/)
SUPABASE_REF=8617532ae1a41571d5d557cd24c6f5f2565d9230
REPO_URL=https://github.com/NicolasMRSN/Food-app.git

mkdir -p "$BASE"
cd "$BASE"

echo "[1/5] Code de l'app (app-src/)"
[ -d app-src/.git ] || git clone -q "$REPO_URL" app-src

echo "[2/5] Fichiers Docker officiels Supabase ($SUPABASE_REF)"
if [ ! -f docker-compose.yml ]; then
  tmp=$(mktemp -d)
  git clone -q --filter=blob:none --no-checkout https://github.com/supabase/supabase.git "$tmp"
  git -C "$tmp" sparse-checkout set docker
  git -C "$tmp" checkout -q "$SUPABASE_REF"
  rsync -a "$tmp/docker/" "$BASE/"
  rm -rf "$tmp"
fi

echo "[3/5] Secrets et configuration (.env)"
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
  setv API_GW_HTTP_PORT "$LAN_IP:8000"
  setv DASHBOARD_USERNAME nicolas
  setv STUDIO_DEFAULT_ORGANIZATION Homelab
  setv STUDIO_DEFAULT_PROJECT Food-app
  echo "LAN_IP=$LAN_IP" >> .env
  rm -f .env.old docker-compose.yml.old
  echo "# food-app configured $(date -I)" >> .env
fi

echo "[4/5] Edge Functions + compose.yaml"
bash app-src/deploy/homelab/sync-functions.sh "$BASE"
python3 app-src/deploy/homelab/make-compose.py

echo "[5/5] Démarrage et base de données"
docker compose up -d --build
until [ "$(docker inspect -f '{{.State.Health.Status}}' supabase-db)" = healthy ]; do sleep 2; done
bash app-src/deploy/homelab/migrate.sh

echo
echo "Food-app : $PUBLIC_URL"
echo "Studio   : http://$LAN_IP:8000 (utilisateur nicolas, mot de passe = DASHBOARD_PASSWORD dans $BASE/.env)"
