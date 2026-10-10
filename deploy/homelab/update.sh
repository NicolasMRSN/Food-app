#!/usr/bin/env bash
# Mise à jour de Food-app sur le homelab après un push sur GitHub :
# récupère le code, applique les nouvelles migrations, recopie les Edge Functions, reconstruit le front.
# Usage : bash /srv/docker/food-app/app-src/deploy/homelab/update.sh
set -euo pipefail

BASE=${1:-/srv/docker/food-app}
cd "$BASE"

git -C app-src pull --ff-only
bash app-src/deploy/homelab/migrate.sh
bash app-src/deploy/homelab/sync-functions.sh "$BASE"
python3 app-src/deploy/homelab/make-compose.py
docker compose up -d --build food-web
docker compose restart functions
docker compose ps --format "table {{.Name}}\t{{.Status}}"
