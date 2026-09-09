-- Diffusion temps réel des changements vers les clients connectés
do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','planned_meals','people','app_settings','shopping_checks','ciqual_foods']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
