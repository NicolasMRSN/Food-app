# Table — Nicolas & Marion

Application privée de planification des repas, construite avec **React (Vite)** et **Supabase**,
auto-hébergée sur le homelab (Docker) et accessible depuis le réseau local de la maison :
**http://192.168.1.192:8081**

## Fonctionnalités
- **Semaine** : planification midi/soir sur 7 jours par glisser-déposer ou autocomplétion, sans obligation de remplir chaque jour ; nombre illimité d'apéritifs, entrées, plats et desserts par repas ; portions modulables (base 2 personnes, incrémentables pour les invités).
- **Recettes** : ajout manuel ou import depuis marmiton.org, jow.fr… (extraction JSON-LD) ; ingrédients référencés dans la table **CIQUAL (ANSES)** ; mode opératoire, image, ustensiles ; catégorisation par type (apéritif, entrée, plat, dessert) et saison (Automne/Hiver, Printemps/Été) ; allergènes (14 allergènes UE) visibles à la sélection.
- **Rapport nutrition** : apports journaliers par personne (kcal, protéines, lipides, glucides, fibres) ; cible calorique modifiable pour Nicolas et Marion ; grammes quotidiens de **Whey Isolate Nutripure** paramétrables et intégrés aux totaux (valeurs /100 g modifiables).
- **Courses** : liste générée depuis la semaine planifiée, quantités agrégées et mises à l'échelle des portions, classée par rayon de supermarché, cases à cocher persistantes.
- **Accès** : réservé à 2 comptes (verrou en base sur `auth.users`), session persistante.

## Développement
```bash
npm install
cp .env.example .env   # renseigner la clé publique (ANON_KEY du serveur)
npm run dev
```

## Hébergement (homelab)
Tout tourne en Docker dans `/srv/docker/food-app` sur `homelab-marsan`, relancé automatiquement au démarrage
(`homelab-stacks.service`). Fichiers dans [`deploy/homelab/`](deploy/homelab/).

| Élément | Détail |
|---|---|
| Front `food-web` | nginx : sert l'app et proxifie `/auth`, `/rest`, `/realtime`, `/functions` vers la passerelle Supabase (même origine) |
| Supabase self-hosted | `supabase-db` (Postgres 17), `supabase-auth`, `supabase-rest`, `realtime-dev.supabase-realtime`, `supabase-edge-functions`, `supabase-envoy`, `supabase-meta`, `supabase-studio` |
| Accès | Réseau local uniquement, sur l'IP du serveur : app sur le port **8081**, Supabase Studio sur le port **8000** (utilisateur `nicolas`, mot de passe `DASHBOARD_PASSWORD` dans `.env`). `LAN_IP` et les URL du `.env` sont mises à jour au démarrage par `homelab-reseau.sh` si la box change |
| Secrets | `/srv/docker/food-app/.env` (généré à l'installation, jamais commité) |

- **Installation** (serveur neuf) : `bash deploy/homelab/install.sh`
- **Mise à jour** après un push : `bash /srv/docker/food-app/app-src/deploy/homelab/update.sh`
  (pull, nouvelles migrations, Edge Functions, rebuild du front)
- **Mot de passe oublié** : `bash /srv/docker/food-app/app-src/deploy/homelab/reset-password.sh` (saisie au clavier, pas d'e-mail)
- **Migrations** : appliquées par `deploy/homelab/migrate.sh`, suivies dans `food_meta.applied_migrations`

## Base de données
- Migrations : `supabase/migrations/` (une nouvelle migration = un nouveau fichier `00NN_nom.sql`, appliqué par `update.sh`)
- Fonction d'import de recettes : `supabase/functions/import-recipe/`
- Référentiel CIQUAL : `data/ciqual_foods.json` (3 311 aliments — table projet CIQUAL 2025 en priorité, complétée par la table officielle ANSES pour les groupes manquants), chargé dans `public.ciqual_foods`.

## Sécurité
- RLS activé sur toutes les tables : lecture/écriture réservées aux utilisateurs authentifiés.
- Un seul compte commun : inscriptions désactivées côté Auth (`DISABLE_SIGNUP=true`) et verrou en base sur `auth.users`.
- La clé « anon » est publique par conception (incluse dans le front) ; les données restent protégées par RLS.
- Aucun port exposé sur Internet : services liés à l'IP locale du serveur, joignables uniquement depuis la maison.
- Trafic en HTTP simple sur le réseau local (pas de HTTPS) : à n'utiliser que sur un Wi-Fi de confiance.
