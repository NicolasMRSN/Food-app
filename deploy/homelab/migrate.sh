#!/usr/bin/env bash
# Applique les migrations de supabase/migrations/ pas encore appliquées (suivi dans food_meta.applied_migrations).
# Au premier passage (base vide), charge aussi le référentiel CIQUAL juste après 0001.
# Usage : bash migrate.sh   (depuis n'importe où ; le conteneur supabase-db doit tourner)
set -euo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
PSQL=(docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At)

"${PSQL[@]}" -c "create schema if not exists food_meta;
  revoke all on schema food_meta from public, anon, authenticated;
  create table if not exists food_meta.applied_migrations (name text primary key, applied_at timestamptz not null default now());"

for f in "$REPO"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  done_already=$("${PSQL[@]}" -c "select 1 from food_meta.applied_migrations where name = '$name'")
  [ -n "$done_already" ] && continue

  echo "-> $name"
  "${PSQL[@]}" < "$f"

  if [[ $name == 0001_* ]] && [ "$("${PSQL[@]}" -c "select count(*) from public.ciqual_foods")" = 0 ]; then
    echo "   chargement CIQUAL (data/ciqual_foods.json)"
    python3 - "$REPO/data/ciqual_foods.json" <<'EOF' | "${PSQL[@]}"
import json, sys
rows = json.load(open(sys.argv[1], encoding="utf-8"))
print("insert into public.ciqual_foods select * from json_populate_recordset(null::public.ciqual_foods, $j$"
      + json.dumps(rows, ensure_ascii=False) + "$j$);")
EOF
  fi

  "${PSQL[@]}" -c "insert into food_meta.applied_migrations(name) values ('$name')"
done
echo "Migrations à jour."
