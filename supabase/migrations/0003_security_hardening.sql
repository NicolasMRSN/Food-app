-- Durcissement : les fonctions trigger ne doivent pas être appelables via l'API
revoke execute on function public.enforce_max_users() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Déplacer pg_trgm hors du schéma public
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
