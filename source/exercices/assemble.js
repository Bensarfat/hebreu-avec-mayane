/* =====================================================================
   Assemble le site de révision complet à partir de :
   - app.html            : le code des exercices (quiz, flashcards, « Réviser », jeux, grammaire, statistiques…),
                           SOURCE UNIQUE, modifiée ici par Maayane ou Benjamin ;
   - ../src/progress.js  : progression (XP, niveaux, badges, graphiques) ;
   - ../src/game.js      : branchement de la progression sur le site ;
   - un fichier de données (vocabulaire, grammaire, conjugaison…) ;
   - un fichier « Passé & futur » (le cours de cet onglet).

   Utilisé :
   - par le site de Maayane (build_templates.js), avec les données de démonstration ;
   - par le site perso de Benjamin (github.com/Bensarfat/hebreu), avec SES données :
       node source/exercices/assemble.js --donnees donnees.js --passe-futur passe-futur.html --sortie index.html

   Les repères @@DONNEES@@, @@PASSE_FUTUR@@ et @@HP@@ doivent rester présents une seule fois dans app.html.
   ===================================================================== */
'use strict';
const fs = require('fs'), path = require('path');
const HERE = __dirname;

const MARK = {
  donnees: '/*@@DONNEES@@*/\n',
  passeFutur: '<!--@@PASSE_FUTUR@@-->\n',
  hp: '<!--@@HP@@-->\n'
};

function once(s, mark, value, label) {
  const parts = s.split(mark);
  if (parts.length !== 2) throw new Error('repère ' + label + ' trouvé ' + (parts.length - 1) + ' fois au lieu d\'une dans app.html');
  return parts.join(value);
}
function nl(s) { s = String(s).replace(/\r\n/g, '\n'); return s.endsWith('\n') ? s : s + '\n'; }

function hpBlock(progressJs, gameJs) {
  return '<script>\n' + String(progressJs).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n</script>\n' +
    '<script>\n' + String(gameJs).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n\ntry { HPG.install(); } catch (e) { console.error("HPG", e); }\n</script>\n';
}

/* opts : { donnees, passeFutur } (textes) ; app, progress, game facultatifs (lus dans ce dépôt sinon) */
function assemble(opts) {
  const read = (p) => fs.readFileSync(p, 'utf8');
  let s = (opts.app || read(path.join(HERE, 'app.html'))).replace(/\r\n/g, '\n');
  const progress = opts.progress || read(path.join(HERE, '..', 'src', 'progress.js'));
  const game = opts.game || read(path.join(HERE, '..', 'src', 'game.js'));
  const donnees = nl(opts.donnees);
  if (donnees.indexOf('const VOCAB = {') !== 0) throw new Error('le fichier de données doit commencer par « const VOCAB = { »');
  s = once(s, MARK.donnees, donnees, '@@DONNEES@@');
  s = once(s, MARK.passeFutur, nl(opts.passeFutur || ''), '@@PASSE_FUTUR@@');
  s = once(s, MARK.hp, hpBlock(progress, game), '@@HP@@');
  return s;
}

module.exports = { assemble, MARK, hpBlock };

if (require.main === module) {
  const a = process.argv.slice(2), arg = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const d = arg('--donnees'), p = arg('--passe-futur'), out = arg('--sortie');
  if (!d || !p || !out) {
    console.error('Usage : node assemble.js --donnees donnees.js --passe-futur passe-futur.html --sortie index.html');
    process.exit(2);
  }
  try {
    const html = assemble({ donnees: fs.readFileSync(d, 'utf8'), passeFutur: fs.readFileSync(p, 'utf8') });
    fs.writeFileSync(out, html);
    console.log('✓ site assemblé : ' + out + ' (' + Math.round(html.length / 1024) + ' Ko)');
  } catch (e) {
    console.error('✗ Assemblage impossible : ' + e.message);
    process.exit(1);
  }
}
