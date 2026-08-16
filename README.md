# Table — Nicolas & Marion

Application privée de planification des repas, construite avec **React (Vite)** et **Supabase**.

## Fonctionnalités
- **Semaine** : planification midi/soir sur 7 jours par glisser-déposer ou autocomplétion, sans obligation de remplir chaque jour ; nombre illimité d'apéritifs, entrées, plats et desserts par repas ; portions modulables (base 2 personnes, incrémentables pour les invités).
- **Recettes** : ajout manuel ou import depuis marmiton.org, jow.fr… (extraction JSON-LD) ; ingrédients référencés dans la table **CIQUAL (ANSES)** ; mode opératoire, image, ustensiles ; catégorisation par type (apéritif, entrée, plat, dessert) et saison (Automne/Hiver, Printemps/Été) ; allergènes (14 allergènes UE) visibles à la sélection.
- **Rapport nutrition** : apports journaliers par personne (kcal, protéines, lipides, glucides, fibres) ; cible calorique modifiable pour Nicolas et Marion ; grammes quotidiens de **Whey Isolate Nutripure** paramétrables et intégrés aux totaux (valeurs /100 g modifiables).
- **Courses** : liste générée depuis la semaine planifiée, quantités agrégées et mises à l'échelle des portions, classée par rayon de supermarché, cases à cocher persistantes.
- **Accès** : réservé à 2 comptes (verrou en base sur `auth.users`), session persistante.

## Démarrage
```bash
npm install
cp .env.example .env   # renseigner l'URL et la clé publique Supabase
npm run dev
```

## Base de données
- Migrations : `supabase/migrations/`
- Fonction d'import de recettes : `supabase/functions/import-recipe/`
- Référentiel CIQUAL : `data/ciqual_foods.json` (3 311 aliments — table projet CIQUAL 2025 en priorité, complétée par la table officielle ANSES pour les groupes manquants), chargé dans `public.ciqual_foods`.

## Sécurité
- RLS activé sur toutes les tables : lecture/écriture réservées aux utilisateurs authentifiés.
- Inscriptions bloquées au-delà de 2 comptes.
- La clé « publishable » Supabase est publique par conception ; les données restent protégées par RLS.
