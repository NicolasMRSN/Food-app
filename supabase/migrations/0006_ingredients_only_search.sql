-- 1) Ne proposer que de vrais ingrédients (exclure plats cuisinés, préemballés, aliments infantiles)
alter table public.ciqual_foods add column if not exists is_ingredient boolean not null default true;

update public.ciqual_foods set is_ingredient = false
where group_fr = 'entrées et plats composés'
   or group_fr = 'aliments infantiles'
   or name_fr ilike '%préemball%'
   or name_fr ilike '%(aliment moyen)%';

-- 2) Recherche insensible aux accents et ligatures (œuf = oeuf), paginée,
--    classement : préfixe > position du terme > alphabétique
create or replace function public.search_foods(q text default '', lim int default 20, off int default 0)
returns setof public.ciqual_foods
language sql stable
set search_path = public, extensions as $$
  select *
  from public.ciqual_foods
  where is_ingredient
    and (coalesce(q,'') = '' or public.f_unaccent(lower(name_fr)) like '%' || public.f_unaccent(lower(q)) || '%')
  order by
    (public.f_unaccent(lower(name_fr)) like public.f_unaccent(lower(coalesce(q,''))) || '%') desc,
    position(public.f_unaccent(lower(coalesce(q,''))) in public.f_unaccent(lower(name_fr))) asc,
    name_fr
  limit greatest(1, least(lim, 60)) offset greatest(0, off);
$$;
revoke execute on function public.search_foods(text,int,int) from public, anon;
grant execute on function public.search_foods(text,int,int) to authenticated;

-- 3) La correspondance automatique d'import ne matche que des ingrédients
--    (branche trigramme : where c.is_ingredient — voir migration appliquée "ingredients_only_and_search")
