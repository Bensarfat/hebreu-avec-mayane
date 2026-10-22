# Hébreu avec Maayane

Site de cours d'hébreu en français : page d'accueil, espace élève (quiz, flashcards, grammaire, XP, niveaux, badges) et back-office de la professeure (comptes élèves, dépôt et analyse de documents, suivi de progression).

- `index.html` : la page publiée (accueil, connexion, espace de Maayane), déployée par Vercel.
- `assets/` : l'espace élève (`student.*.txt`) et les données de démonstration (`demo.*.json`), chargés seulement quand on en a besoin. Leur nom contient une empreinte du contenu, ce qui permet de les garder en cache longtemps. Ne pas modifier à la main : ils sont produits par `source/build.js`.
- `api/analyse.js` : fonction Vercel d'analyse des documents par Claude.
- `source/` : les sources.

## Lien avec le site de Benjamin

Le code des exercices des élèves (quiz, flashcards, « Réviser », jeux, grammaire, statistiques) se trouve ici, dans `source/exercices/app.html`.
Le site perso de Benjamin (`Bensarfat/hebreu`) le recopie toutes les heures et l'assemble avec ses propres données
(action « Assembler le site » de son dépôt) : une amélioration fusionnée ici arrive chez lui automatiquement.

Construire à la main :
```
cd source && node src/build_templates.js && node build.js
```
Chaque pull request est vérifiée automatiquement (action « Vérifier la construction »).

## Analyse automatique des documents

Dans Vercel > Settings > Environment Variables :

- `ANTHROPIC_API_KEY` : une clé créée sur console.anthropic.com (obligatoire)
- `ANALYSE_CODE` : un code à saisir dans Réglages > Code d'analyse (facultatif)

Puis redéployer. Sans clé, le site propose l'import manuel d'un fichier .json préparé par Claude.

## Mode en ligne (Supabase)

Sans réglage, le site fonctionne en mode démonstration (données dans le navigateur). Relié à Supabase, chaque élève retrouve son espace sur n'importe quel appareil.

1. Supabase > SQL Editor : exécuter `supabase/schema.sql`.
2. Supabase > Authentication > Sign In / Providers : décocher « Allow new users to sign up » (les comptes sont créés uniquement par le serveur) et, dans Email, « Confirm email ».
3. Vercel > Settings > Environment Variables : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clé publique « anon » ou « publishable »), `SUPABASE_SERVICE_ROLE_KEY` (clé secrète « service_role » ou « secret » — ne jamais la partager), puis Redeploy.
4. À la première ouverture, le site propose de créer le compte de la professeure.
5. Mises à jour de la base : exécuter dans l'ordre les fichiers `supabase/migration-*.sql` (déjà inclus dans `schema.sql` pour une nouvelle installation).

## Agenda (réservation des cours)

- **Maayane** : onglet « Agenda » — calendrier de la semaine (tous les élèves), « Disponibilités » (heures habituelles par jour, durées proposées — 1 h, 1 h 30, 2 h par défaut, modifiables —, délais, pause entre deux cours, nombre de cours à venir par élève, message aux élèves), fermetures et vacances, ajout ou annulation d'un cours, lien privé à ajouter dans Google Agenda / Apple Calendrier.
- **Élèves** : bouton « 📅 Mes cours » dans leur espace — leurs cours à venir, les créneaux libres (sans le nom des autres élèves), réservation, annulation (jusqu'au délai fixé par Maayane), ajout à leur agenda (.ics). Horaires affichés à l'heure de leur appareil.
- **Sécurité** : les élèves réservent via `/api/agenda`, qui revérifie le créneau (`api/_agenda.js`, le même calcul que dans le navigateur) ; la base refuse deux cours qui se chevauchent (contrainte `bookings_no_overlap`).
- **Installation** : exécuter `supabase/migration-2026-10-20-agenda.sql` dans Supabase > SQL Editor (déjà inclus dans `schema.sql` pour une nouvelle installation).
