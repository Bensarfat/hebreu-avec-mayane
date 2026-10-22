# Consignes pour Claude — site « Hébreu avec Maayane »

Ce dépôt est modifié par Maayane (professeure, pas développeuse) et par Benjamin, chacun avec son propre compte Claude.
Réponds toujours en français, en mots simples, sans jargon. Explique ce que tu changes du point de vue de l'utilisateur du site.

## Règles de travail (obligatoires)

1. **Ne pousse jamais sur `main`.** Travaille toujours sur une branche nouvelle (`maayane/<sujet-court>`), puis ouvre une pull request vers `main`.
   Maayane relit l'aperçu et fusionne elle-même. La fusion publie le site en une minute environ.
2. **Une demande = une branche = une pull request.** Garde les changements petits et ciblés.
3. **Avant de terminer**, récupère la dernière version de `main` dans ta branche (`git merge origin/main`), puis reconstruis :
   ```
   cd source && node src/build_templates.js && node build.js
   ```
   Si `index.html`, `version.json` ou `assets/` sont en conflit, prends n'importe quelle version puis reconstruis : ces fichiers sont produits par le build.
   Commite le résultat du build (`index.html`, `version.json`, `assets/`), car Vercel publie ces fichiers tels quels.
4. Vérifie la syntaxe : `for f in api/*.js; do node -e "require('./$f')"; done` doit être silencieux.
5. Dans la description de la pull request, écris en français : ce qui change pour Maayane ou les élèves, comment le vérifier sur l'aperçu, et ce qui n'a pas été fait.
6. Ne demande, n'affiche et n'écris jamais de mot de passe, de clé ou de jeton. Les clés sont dans Vercel (réglées par Benjamin).

## Où se trouve quoi

- `source/src/home.js` : page d'accueil publique (textes, présentation de Maayane).
- `source/src/app.js` : espace de Maayane (tableau de bord, élèves, documents, réglages) et barre de l'espace élève.
- `source/src/agenda-ui.js` + `api/_agenda.js` + `api/agenda.js` : agenda et réservation des cours.
- `source/src/analyse.js` + `api/analyse.js` : analyse des documents par Claude (consignes d'analyse dans `rules()` et `context()`).
- `source/src/shell.css` : couleurs, typographie et mise en page de l'espace de Maayane.
- `source/src/backend*.js` : lecture et écriture des données (mode démo et mode en ligne Supabase).
- `api/*.js` : fonctions serveur Vercel. `supabase/` : schéma de la base.
- `index.html`, `version.json`, `assets/` : **fichiers produits par le build, ne jamais les modifier à la main.**

## Ce qui ne se modifie pas ici

- **Les exercices de l'espace élève** (quiz, flashcards, onglet « Réviser » et ses jeux, conjugaison, grammaire, statistiques, XP, badges)
  viennent du site de Benjamin, dépôt **`Bensarfat/hebreu`** (site perso https://hebreu-eight.vercel.app).
  `source/src/original.html` en est une copie remplacée toutes les heures, et le bloc « HP » (`progress.js`, `game.js`) de son site a priorité :
  une modification de ces parties faite **ici** serait écrasée.
  **Benjamin autorise Maayane à les modifier elle-même** : Maayane est collaboratrice de `Bensarfat/hebreu`.
  Quand elle demande une nouvelle révision, un nouveau jeu ou un changement dans les exercices, travaille dans **`Bensarfat/hebreu`**
  (ajoute ce dépôt à la session si besoin) en suivant son propre `CLAUDE.md` : branche + pull request, vérification que ce site-ci se construit toujours.
  Une fois fusionnée là-bas, la modification apparaît sur le site perso de Benjamin tout de suite, et ici dans l'heure
  (ou tout de suite : onglet **Actions** de ce dépôt › « Synchroniser avec le site de Benjamin » › **Run workflow**).
  Si la révision a besoin d'une nouvelle donnée produite par l'analyse des documents (définition, phrase d'exemple…),
  fais en plus, ici, une pull request séparée : `source/src/analyse.js` (la produire) et le chargeur de `source/src/build_templates.js` (la transmettre).
- **La base de données** : si un changement exige une nouvelle colonne ou table, écris un nouveau fichier `supabase/migration-AAAA-MM-JJ-<sujet>.sql`
  et dis clairement à Maayane que Benjamin doit l'exécuter dans Supabase **avant** la fusion. Ne fusionne rien qui dépend d'une migration non exécutée.
- `.github/workflows/` et `vercel.json` : ne pas modifier sans demande explicite de Benjamin.

## Style

- Interface en français. Côté élève : tutoiement. Côté Maayane : vouvoiement.
- Les mots en hébreu sont dans un élément avec `lang="he" dir="rtl"`.
- Garde l'identité visuelle existante (variables CSS de `shell.css`), les contrastes lisibles et le fonctionnement sur téléphone (largeur 360 px).
