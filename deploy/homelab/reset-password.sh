#!/usr/bin/env bash
# Définit un nouveau mot de passe pour un compte Food-app (pas d'e-mail de réinitialisation : aucun SMTP configuré).
# Le mot de passe est saisi au clavier et envoyé à l'API admin de Supabase Auth locale ; il n'est ni affiché ni stocké.
# Usage : bash reset-password.sh [EMAIL]   (défaut : le compte commun)
set -euo pipefail

BASE=/srv/docker/food-app
EMAIL=${1:-nicolasmarsan33@gmail.com}
SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' "$BASE/.env" | cut -d= -f2-)
API=http://127.0.0.1:8000/auth/v1/admin/users

USER_ID=$(docker exec supabase-db psql -U supabase_admin -d postgres -At \
  -c "select id from auth.users where email = '$EMAIL'")
[ -n "$USER_ID" ] || { echo "Aucun compte pour $EMAIL"; exit 1; }

while true; do
  read -rsp "Nouveau mot de passe pour $EMAIL (8 caractères minimum) : " P1; echo
  read -rsp "Confirme le mot de passe : " P2; echo
  if [ "$P1" != "$P2" ]; then echo "Les deux saisies sont différentes, recommence."; continue; fi
  if [ ${#P1} -lt 8 ]; then echo "Trop court (8 caractères minimum), recommence."; continue; fi
  break
done

code=$(jq -n --arg p "$P1" '{password: $p}' | curl -s -o /dev/null -w '%{http_code}' -X PUT "$API/$USER_ID" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' --data @-)
unset P1 P2

if [ "$code" = 200 ]; then
  echo "Mot de passe modifié. Connecte-toi sur l'app avec $EMAIL et ce nouveau mot de passe."
else
  echo "Échec (code HTTP $code)."; exit 1
fi
