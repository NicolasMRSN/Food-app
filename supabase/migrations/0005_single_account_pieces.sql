-- Compte commun unique : le verrou passe de 2 à 1 utilisateur
create or replace function public.enforce_max_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'max_users: le compte commun existe déjà';
  end if;
  return new;
end $$;

-- Personnes du foyer (découplées de l'authentification)
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  daily_kcal_target numeric not null default 2000,
  whey_grams_daily numeric not null default 0,
  sort int not null default 0
);
alter table public.people enable row level security;
drop policy if exists auth_all_people on public.people;
create policy auth_all_people on public.people for all to authenticated using (true) with check (true);

insert into public.people (name, daily_kcal_target, whey_grams_daily, sort) values
  ('Nicolas', 2000, 0, 1),
  ('Marion', 2000, 0, 2)
on conflict (name) do nothing;

-- Ingrédients "à la pièce" : nombre de pièces en plus du grammage
alter table public.recipe_ingredients add column if not exists pieces numeric check (pieces is null or pieces > 0);
update public.recipe_ingredients set pieces = 2 where label = 'Œufs' and quantity_g = 110;
