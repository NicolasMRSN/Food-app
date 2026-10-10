#!/usr/bin/env bash
# Copie les Edge Functions du dépôt (supabase/functions/*) dans volumes/functions/ de l'instance Supabase.
# Le routeur "main" fourni par Supabase est conservé ; l'exemple "hello" est retiré.
# Usage : bash sync-functions.sh [DOSSIER]   (défaut /srv/docker/food-app)
set -euo pipefail

BASE=${1:-/srv/docker/food-app}
REPO=$(cd "$(dirname "$0")/../.." && pwd)

rm -rf "$BASE/volumes/functions/hello"
for fn in "$REPO"/supabase/functions/*/; do
  name=$(basename "$fn")
  rm -rf "$BASE/volumes/functions/$name"
  cp -r "$fn" "$BASE/volumes/functions/$name"
  echo "   fonction : $name"
done
