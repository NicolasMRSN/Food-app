-- La correspondance automatique d'import ne matche que des ingrédients (is_ingredient).
-- Version appliquée en production (migration "ingredients_only_and_search"),
-- absente jusqu'ici des fichiers du dépôt (0006 ne contenait qu'un commentaire).
create or replace function public.match_ciqual(labels text[])
returns table(label text, ciqual_code int, name_fr text, score real)
language sql stable
set search_path = public, extensions
as $$
  select l.label, m.ciqual_code, m.name_fr, m.score
  from unnest(labels) as l(label)
  cross join lateral (
    select a.ciqual_code, c.name_fr, 1.0::real as score
    from public.ciqual_aliases a
    join public.ciqual_foods c using (ciqual_code)
    where a.alias = public.norm_ingredient(l.label)
    union all
    (select a.ciqual_code, c.name_fr,
            extensions.similarity(a.alias, public.norm_ingredient(l.label))::real * 0.9
     from public.ciqual_aliases a
     join public.ciqual_foods c using (ciqual_code)
     where extensions.similarity(a.alias, public.norm_ingredient(l.label)) >= 0.4
     order by extensions.similarity(a.alias, public.norm_ingredient(l.label)) desc
     limit 1)
    union all
    (select c.ciqual_code, c.name_fr,
            extensions.similarity(public.norm_ingredient(c.name_fr), public.norm_ingredient(l.label))::real * 0.8
     from public.ciqual_foods c
     where c.is_ingredient
     order by
       extensions.similarity(public.norm_ingredient(c.name_fr), public.norm_ingredient(l.label)) desc,
       (c.name_fr ilike '%cru%') desc,
       length(c.name_fr) asc
     limit 1)
    order by score desc
    limit 1
  ) m;
$$;
revoke execute on function public.match_ciqual(text[]) from public, anon;
grant execute on function public.match_ciqual(text[]) to authenticated;
