# Hébreu avec Mayane

Site de cours d'hébreu en français : page d'accueil, espace élève (quiz, flashcards, grammaire, XP, niveaux, badges) et back-office de la professeure (comptes élèves, dépôt et analyse de documents, suivi de progression).

- `index.html` : le site publié (fichier unique, déployé par Vercel).
- `source/` : les sources. Pour régénérer `index.html` :
  ```
  cd source && node src/build_templates.js && node build.js
  ```

Version de démonstration : les comptes, documents et statistiques sont enregistrés dans le navigateur de chaque utilisateur.

## Analyse automatique des documents

La fonction `api/analyse.js` (Vercel) envoie le document à Claude. Pour l'activer, dans Vercel > Settings > Environment Variables :

- `ANTHROPIC_API_KEY` : une clé créée sur console.anthropic.com (obligatoire)
- `ANALYSE_CODE` : un code à saisir dans Réglages > Code d'analyse (facultatif, évite qu'un inconnu utilise la clé)

Puis redéployer. Sans clé, le site propose l'import manuel d'un fichier .json préparé par Claude.
