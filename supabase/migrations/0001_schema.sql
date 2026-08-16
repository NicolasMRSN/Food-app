-- Schéma Food-app (Nicolas & Marion)

create extension if not exists pg_trgm;

-- 1) Référentiel CIQUAL (ANSES) : valeurs pour 100 g + rayon supermarché
create table if not exists public.ciqual_foods (
  ciqual_code int primary key,
  name_fr text not null,
  group_fr text,
  subgroup_fr text,
  aisle text not null default 'Épicerie salée',
  kcal_100g numeric,
  protein_100g numeric,
  carb_100g numeric,
  fat_100g numeric,
  fiber_100g numeric,
  source text
);
create index if not exists ciqual_foods_name_idx on public.ciqual_foods using gin (name_fr gin_trgm_ops);

-- 2) Profils (Nicolas, Marion) : cible kcal + whey quotidienne
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  daily_kcal_target numeric not null default 2000,
  whey_grams_daily numeric not null default 0
);

-- 3) Recettes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('apéritif','entrée','plat','dessert')),
  season text not null default 'Toute l''année'
    check (season in ('Automne/Hiver','Printemps/Été','Toute l''année')),
  instructions text,
  image_url text,
  utensils text[] not null default '{}',
  allergens text[] not null default '{}',
  source_url text,
  servings_base int not null default 2,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ciqual_code int not null references public.ciqual_foods(ciqual_code),
  label text not null,
  quantity_g numeric not null check (quantity_g > 0)
);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);

-- 4) Planning : plusieurs plats possibles par créneau
create table if not exists public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null,
  slot text not null check (slot in ('midi','soir')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  servings int not null default 2 check (servings >= 1),
  created_at timestamptz not null default now()
);
create index if not exists planned_meals_date_idx on public.planned_meals(meal_date);

-- 5) Suivi de la liste de courses (cases cochées, par semaine)
create table if not exists public.shopping_checks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  ciqual_code int not null,
  label text,
  checked boolean not null default false,
  unique (week_start, ciqual_code)
);

-- 6) Réglages applicatifs (Whey Isolate Nutripure, modifiable)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings(key, value) values (
  'whey_nutripure',
  '{"kcal_100g":372,"protein_100g":87.4,"carb_100g":3.6,"fat_100g":1.4,"fiber_100g":0}'
) on conflict (key) do nothing;
