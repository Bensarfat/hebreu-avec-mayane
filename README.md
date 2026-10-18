# Hébreu avec Mayane

Site de cours d'hébreu en français : page d'accueil, espace élève (quiz, flashcards, grammaire, XP, niveaux, badges) et back-office de la professeure (comptes élèves, dépôt et analyse de documents, suivi de progression).

- `index.html` : le site publié (fichier unique, déployé par Vercel).
- `api/analyse.js` : fonction Vercel d'analyse des documents par Claude.
- `source/` : les sources.

## Lien avec le site de Benjamin

L'espace élève est construit à partir du site personnel de Benjamin (`Bensarfat/hebreu`). Toutes les heures, l'action « Synchroniser avec le site de Benjamin » récupère son `index.html`, reconstruit le site et le publie : chaque nouvelle fonction ajoutée chez Benjamin arrive chez Mayane, sans ses données (chaque élève garde les contenus issus des documents de Mayane).

Pour lancer la synchronisation tout de suite : onglet **Actions** → « Synchroniser avec le site de Benjamin » → **Run workflow**.

Si une synchronisation échoue (un repère a disparu du site de Benjamin), GitHub envoie un e-mail et le site de Mayane garde sa version précédente.

Construire à la main :
```
cd source && node src/build_templates.js && node build.js
```

## Analyse automatique des documents

Dans Vercel > Settings > Environment Variables :

- `ANTHROPIC_API_KEY` : une clé créée sur console.anthropic.com (obligatoire)
- `ANALYSE_CODE` : un code à saisir dans Réglages > Code d'analyse (facultatif)

Puis redéployer. Sans clé, le site propose l'import manuel d'un fichier .json préparé par Claude.
