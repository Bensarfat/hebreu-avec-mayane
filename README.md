# Hébreu avec Mayane

Site de cours d'hébreu en français : page d'accueil, espace élève (quiz, flashcards, grammaire, XP, niveaux, badges) et back-office de la professeure (comptes élèves, dépôt et analyse de documents, suivi de progression).

- `index.html` : le site publié (fichier unique, déployé par Vercel).
- `source/` : les sources. Pour régénérer `index.html` :
  ```
  cd source && node src/build_templates.js && node build.js
  ```

Version de démonstration : les comptes, documents et statistiques sont enregistrés dans le navigateur de chaque utilisateur.
