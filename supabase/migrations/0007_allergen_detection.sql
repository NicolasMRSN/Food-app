-- Détection des 14 allergènes UE au niveau de chaque aliment CIQUAL
alter table public.ciqual_foods add column if not exists allergens text[] not null default '{}';

create or replace function public.compute_allergens(p_name text, p_grp text, p_sgrp text)
returns text[] language sql immutable
set search_path = public, extensions as $$
with v as (
  select public.f_unaccent(lower(coalesce(p_name,''))) as n,
         public.f_unaccent(lower(coalesce(p_grp,''))) as g,
         public.f_unaccent(lower(coalesce(p_sgrp,''))) as s
)
select coalesce(array_agg(x order by x), '{}') from v, unnest(array[
  case when s ~ 'pains'
        or (n ~ '(\mble\M|froment|epeautre|seigle|\morge\M|avoine|boulgour|couscous|\mpates\M|\mpain\M|biscotte|chapelure|brioche|croissant|viennoiserie|biscuit|gnocchi|semoule|\mfarine\M)'
            and n !~ '(sarrasin|\mriz\M|\mmais\M|chataigne|pois chiche|lentille|coco)')
       then 'Gluten' end,
  case when n ~ '(crevette|crabe|homard|langoust|ecrevisse|gambas)' then 'Crustacés' end,
  case when (s ~ '^oeufs$' or n ~ '\moeufs?\M' or n ~ 'mayonnaise')
        and n !~ 'oeufs de (lompe|cabillaud|truite|saumon|poisson|lump)'
       then 'Œufs' end,
  case when s ~ 'poisson' or n ~ '(saumon|cabillaud|\mthon\M|truite|sardine|maquereau|\mcolin\M|merlu|anchois|hareng|\msole\M|dorade|daurade|\mbar\M|lieu noir|eglefin|fletan|morue|rouget|turbot|esturgeon|oeufs de|surimi|tarama|poisson)'
       then 'Poissons' end,
  case when n ~ '(arachide|cacahuete)' then 'Arachides' end,
  case when n ~ '(\msoja\M|tofu|tempeh|edamame)' then 'Soja' end,
  case when (g ~ 'produits laitiers'
             or n ~ '(\mlait\M|beurre|\mcreme\M|fromage|yaourt|parmesan|gruyere|emmental|mozzarella|feta\M|mascarpone|comte|roquefort|camembert|chevre|brebis)')
        and n !~ '(lait de coco|lait d.amande|lait de soja|lait d.avoine|lait de riz|creme de marron|beurre de cacahuete|beurre de cacao)'
       then 'Lait' end,
  case when (n ~ '(amande|noisette|cajou|pistache|pecan|macadamia|noix du bresil)' and n !~ 'amande de mer')
        or (n ~ '\mnoix\M' and n !~ 'noix de (coco|muscade|veau|saint|petoncle|coquille)')
       then 'Fruits à coque' end,
  case when n ~ 'celeri' then 'Céleri' end,
  case when n ~ 'moutarde' then 'Moutarde' end,
  case when n ~ '(sesame|tahin)' then 'Sésame' end,
  case when n ~ '(\mvin\M|vinaigre)' then 'Sulfites' end,
  case when n ~ 'lupin' then 'Lupin' end,
  case when n ~ '(moule|huitre|calamar|calmar|encornet|seiche|poulpe|pieuvre|escargot|bulot|bigorneau|palourde|\mcoque\M|coquille|saint-jacques|amande de mer|ormeau|\mcouteau\M)'
       then 'Mollusques' end
]) t(x) where x is not null
$$;
revoke execute on function public.compute_allergens(text,text,text) from public, anon;

update public.ciqual_foods
set allergens = public.compute_allergens(name_fr, group_fr, subgroup_fr);

-- Agrégation des allergènes d'une liste d'ingrédients (utilisée à l'import)
create or replace function public.allergens_for(codes int[])
returns text[] language sql stable
set search_path = public as $$
  select coalesce(array_agg(distinct a order by a), '{}')
  from public.ciqual_foods, unnest(allergens) a
  where ciqual_code = any(codes);
$$;
revoke execute on function public.allergens_for(int[]) from public, anon;
grant execute on function public.allergens_for(int[]) to authenticated;
