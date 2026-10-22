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

- `source/exercices/app.html` : **le code des exercices des élèves** (quiz, flashcards, onglet « Réviser » et ses jeux, grammaire,
  vocabulaire, « Passé & futur », statistiques, audio). Source unique, partagée avec le site perso de Benjamin (voir plus bas).
- `source/src/progress.js` + `source/src/game.js` : progression (XP, niveaux, séries, badges, graphiques), partagée aussi.
- `source/exercices/assemble.js` : assemble `app.html` + progression + données ; `donnees-demo.js` et `passe-futur-demo.html` : données de démonstration.
- `source/src/home.js` : page d'accueil publique (textes, présentation de Maayane).
- `source/src/app.js` : espace de Maayane (tableau de bord, élèves, documents, réglages) et barre de l'espace élève.
- `source/src/agenda-ui.js` + `api/_agenda.js` + `api/agenda.js` : agenda et réservation des cours.
- `source/src/analyse.js` + `api/analyse.js` : analyse des documents par Claude (consignes d'analyse dans `rules()` et `context()`).
- `source/src/shell.css` : couleurs, typographie et mise en page de l'espace de Maayane.
- `source/src/backend*.js` : lecture et écriture des données (mode démo et mode en ligne Supabase).
- `api/*.js` : fonctions serveur Vercel. `supabase/` : schéma de la base.
- `index.html`, `version.json`, `assets/` : **fichiers produits par le build, ne jamais les modifier à la main.**

## Exercices des élèves : ici, et partagés avec le site de Benjamin

- Les exercices se modifient **ici**, dans `source/exercices/app.html` (et `source/src/progress.js` / `game.js` pour XP et badges).
  Maayane peut ajouter de nouvelles révisions et de nouveaux jeux : c'est autorisé par Benjamin.
- **Le site perso de Benjamin** (`Bensarfat/hebreu`, https://hebreu-eight.vercel.app) recopie ce code toutes les heures et l'assemble avec
  SES données : une nouvelle révision fusionnée ici arrive chez lui automatiquement (ou tout de suite : dans `Bensarfat/hebreu`, onglet **Actions**
  › « Assembler le site » › **Run workflow**). Elle doit donc fonctionner avec n'importe quelles données : ne suppose pas qu'un champ existe,
  cache le jeu si la donnée manque.
- Repères à garder **une seule fois** dans `app.html` : `/*@@DONNEES@@*/`, `<!--@@PASSE_FUTUR@@-->` (dans `<div class="panel" id="panel-tenses">`),
  `<!--@@HP@@-->` (entre `<!-- HP:BEGIN` et `<!-- HP:END -->`), `<div class="panel" id="panel-stats">` (après Passé & futur ; aucun panneau entre les deux),
  `const STORAGE_KEY = 'hebrew_quiz_v2';`, `const raw = localStorage.getItem(STORAGE_KEY);`, `<div class="container">`, `<meta name="viewport"`.
  La construction s'arrête avec un message clair si l'un d'eux manque.
- Nouveau jeu : dans le module `RÉVISER` d'`app.html`, ajoute une entrée dans `GAMES` et une carte dans `render()` ; enregistre chaque réponse avec
  `updateWordStat({ he, fr }, 'correct' | 'wrong')` (statistiques, XP et révision espacée suivent).
- Nouvelle donnée par mot (définition, phrase d'exemple…) : la produire dans `source/src/analyse.js`, la transmettre dans le chargeur de
  `source/src/build_templates.js` (liste `const VOCAB = __D.VOCAB || {}` …), l'ajouter vide dans `donnees-demo.js`, et l'utiliser avec une garde
  (`typeof DEFS !== 'undefined'`). Préviens que Benjamin devra l'ajouter dans son `donnees.js` pour l'avoir chez lui.
- Teste : ouvre `source/build/original.html` (le site de révision assemblé avec les données de démo) sur ordinateur et en 360 px, sans erreur dans la console.

## Ce qui ne se modifie pas ici

- **La base de données** : si un changement exige une nouvelle colonne ou table, écris un nouveau fichier `supabase/migration-AAAA-MM-JJ-<sujet>.sql`
  et dis clairement à Maayane que Benjamin doit l'exécuter dans Supabase **avant** la fusion. Ne fusionne rien qui dépend d'une migration non exécutée.
- Le vocabulaire personnel de Benjamin : il est dans son dépôt (`Bensarfat/hebreu`, fichiers `donnees.js` et `passe-futur.html`).
- `.github/workflows/` et `vercel.json` : ne pas modifier sans demande explicite de Benjamin.

## Style

- Interface en français. Côté élève : tutoiement. Côté Maayane : vouvoiement.
- Les mots en hébreu sont dans un élément avec `lang="he" dir="rtl"`.
- Garde l'identité visuelle existante (variables CSS de `shell.css`), les contrastes lisibles et le fonctionnement sur téléphone (largeur 360 px).
