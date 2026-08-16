-- Sécurité : accès réservé à 2 comptes (Nicolas & Marion)

-- Verrou : refuser toute inscription au-delà de 2 utilisateurs
create or replace function public.enforce_max_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from auth.users) >= 2 then
    raise exception 'max_users: accès limité à 2 comptes';
  end if;
  return new;
end $$;

drop trigger if exists max_users_trigger on auth.users;
create trigger max_users_trigger
  before insert on auth.users
  for each row execute function public.enforce_max_users();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS : données partagées entre comptes authentifiés, rien en anonyme
alter table public.ciqual_foods enable row level security;
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.planned_meals enable row level security;
alter table public.shopping_checks enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists auth_read on public.ciqual_foods;
create policy auth_read on public.ciqual_foods for select to authenticated using (true);

drop policy if exists auth_all_profiles on public.profiles;
create policy auth_all_profiles on public.profiles for all to authenticated using (true) with check (true);
drop policy if exists auth_all_recipes on public.recipes;
create policy auth_all_recipes on public.recipes for all to authenticated using (true) with check (true);
drop policy if exists auth_all_ri on public.recipe_ingredients;
create policy auth_all_ri on public.recipe_ingredients for all to authenticated using (true) with check (true);
drop policy if exists auth_all_pm on public.planned_meals;
create policy auth_all_pm on public.planned_meals for all to authenticated using (true) with check (true);
drop policy if exists auth_all_sc on public.shopping_checks;
create policy auth_all_sc on public.shopping_checks for all to authenticated using (true) with check (true);
drop policy if exists auth_all_settings on public.app_settings;
create policy auth_all_settings on public.app_settings for all to authenticated using (true) with check (true);
