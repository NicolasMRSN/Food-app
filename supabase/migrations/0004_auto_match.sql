-- Correspondance automatique améliorée : normalisation + alias + trigramme
create extension if not exists unaccent with schema extensions;

-- unaccent est STABLE ; wrapper IMMUTABLE pour usage dans les expressions
create or replace function public.f_unaccent(text)
returns text language sql immutable strict parallel safe
set search_path = extensions as
$$ select extensions.unaccent('extensions.unaccent', $1) $$;

-- Normalisation d'un libellé d'ingrédient : minuscules, sans accents,
-- sans mots contenants (gousse, brin…) ni mots vides, sans pluriels simples.
create or replace function public.norm_ingredient(t text)
returns text language sql immutable parallel safe
set search_path = public as
$$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(public.f_unaccent(lower(coalesce(t,''))), '[^a-z ]', ' ', 'g'),
        '\m(gousses?|brins?|branches?|feuilles?|sachets?|pincees?|cuillerees?|cuilleres?|tranches?|zestes?|belles?|grosses?|grandes?|petites?|petits?|beaux?|soupe|cafe|verres?|pots?|boites?|bols?)\M', ' ', 'g'),
      '\m(de|du|des|d|l|la|le|les|un|une|en|a|au|aux|et|ou|environ|frais|fraiche|fraiches)\M', ' ', 'g'),
    's\M', '', 'g'));
$$;

-- Dictionnaire d'alias : ingrédients de cuisine courants -> code CIQUAL vérifié
create table if not exists public.ciqual_aliases (
  alias text primary key,
  ciqual_code int not null references public.ciqual_foods(ciqual_code)
);
alter table public.ciqual_aliases enable row level security;
drop policy if exists auth_read_aliases on public.ciqual_aliases;
create policy auth_read_aliases on public.ciqual_aliases for select to authenticated using (true);

insert into public.ciqual_aliases (alias, ciqual_code) values
  ('farine', 9436), ('farine ble', 9436),
  ('sucre', 31016), ('sucre poudre', 31016), ('sucre semoule', 31016),
  ('sucre roux', 31017), ('cassonade', 31017),
  ('oeuf', 22000), ('uf', 22000),
  ('beurre', 16400), ('beurre doux', 16400),
  ('lait', 19041), ('lait entier', 19023), ('lait demi ecreme', 19041),
  ('creme fraiche', 19410), ('creme fraiche epaisse', 19410), ('creme epaisse', 19410),
  ('creme', 19402), ('creme liquide', 19415), ('creme fleurette', 19415), ('creme semi epaisse', 19415),
  ('huile olive', 17270), ('huile', 17440), ('huile tournesol', 17440),
  ('ail', 11000), ('oignon', 20034), ('oignon rouge', 20034), ('echalote', 20097),
  ('sel', 11058), ('sel fin', 11058), ('gros sel', 11058), ('sel poivre', 11058),
  ('poivre', 11015), ('poivre noir', 11015),
  ('persil', 11014), ('thym', 11070), ('laurier', 11053), ('basilic', 11033),
  ('coriandre', 11094), ('ciboulette', 11014), ('menthe', 11027),
  ('gingembre', 11074), ('curry', 11005), ('paprika', 11049), ('cumin', 11042), ('cannelle', 11025),
  ('vanille', 11057), ('extrait vanille', 11065), ('sucre vanille', 31016),
  ('moutarde', 11013), ('moutarde ancienne', 11021),
  ('vinaigre', 11220), ('vinaigre vin', 11220), ('vinaigre balsamique', 11091),
  ('tomate', 20047), ('courgette', 20020), ('aubergine', 20053),
  ('poivron', 20087), ('poivron rouge', 20087), ('carotte', 20009),
  ('pomme terre', 4008), ('concombre', 20019), ('poireau', 20039),
  ('champignon', 20056), ('champignon pari', 20056), ('celeri', 20023),
  ('citron', 13009), ('citron vert', 13067), ('pomme', 13050), ('banane', 13005),
  ('riz', 9100), ('riz blanc', 9100), ('pate', 9810), ('spaghetti', 9810), ('tagliatelle', 9810),
  ('penne', 9810), ('lentille', 20587), ('lentille verte', 20587), ('poi chiche', 20507),
  ('quinoa', 9100), ('fecule', 4090), ('maizena', 4090), ('chapelure', 7500),
  ('levure', 11045), ('levure boulanger', 11045), ('levure chimique', 11045),
  ('poulet', 36017), ('filet poulet', 36017), ('blanc poulet', 36017), ('escalope poulet', 36017),
  ('poitrine poulet', 36029),
  ('boeuf', 6250), ('boeuf hache', 6250), ('steak hache', 6250), ('viande hachee', 6250),
  ('lardon', 28502), ('lardon fume', 28502), ('bacon', 28727),
  ('jambon', 28900), ('jambon blanc', 28900),
  ('saumon', 26036), ('pave saumon', 26036), ('filet saumon', 26036),
  ('crevette', 10007),
  ('parmesan', 12120), ('parmesan rape', 12120),
  ('gruyere', 12114), ('gruyere rape', 12114),
  ('emmental', 12115), ('emmental rape', 12118), ('fromage rape', 12118),
  ('mozzarella', 19590), ('feta', 12066), ('mascarpone', 19584),
  ('yaourt', 19593), ('yaourt nature', 19593),
  ('fromage blanc', 19501),
  ('chocolat', 31085), ('chocolat noir', 31085), ('chocolat patissier', 31085),
  ('miel', 31008),
  ('vin blanc', 5215), ('vin blanc sec', 5215), ('vin rouge', 5214),
  ('bouillon', 11174), ('bouillon volaille', 11174), ('bouillon legume', 25948), ('cube bouillon', 11174),
  ('sucre glace', 31016)
on conflict (alias) do update set ciqual_code = excluded.ciqual_code;

-- Fonction de correspondance : alias exact > alias partiel > trigramme sur les noms CIQUAL
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
     where c.group_fr is distinct from 'aliments infantiles'
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
revoke execute on function public.norm_ingredient(text) from public, anon;
revoke execute on function public.f_unaccent(text) from public, anon;
