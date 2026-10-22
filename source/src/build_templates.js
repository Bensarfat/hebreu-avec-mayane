/* Construit le gabarit « espace élève » du site de Maayane.

   Le code des exercices (quiz, flashcards, « Réviser », jeux, grammaire, statistiques…) se trouve ICI,
   dans source/exercices/app.html : c'est la source unique, que le site perso de Benjamin (github.com/Bensarfat/hebreu)
   recopie automatiquement toutes les heures avec ses propres données.

   Ce script assemble app.html avec les données de démonstration (source/exercices/donnees-demo.js et
   passe-futur-demo.html), puis en retire les DONNÉES : chaque élève reçoit les siennes, issues des documents de Maayane.

   Si un repère attendu manque, la construction s'arrête avec un message clair (rien n'est publié à moitié). */
const fs = require('fs'), path = require('path');
const S = __dirname, OUT = path.join(S, '..', 'build');
fs.mkdirSync(OUT, { recursive: true });
let src;
try {
  src = require('../exercices/assemble.js').assemble({
    donnees: fs.readFileSync(path.join(S, '..', 'exercices', 'donnees-demo.js'), 'utf8'),
    passeFutur: fs.readFileSync(path.join(S, '..', 'exercices', 'passe-futur-demo.html'), 'utf8')
  });
} catch (e) { console.error('\n✗ Construction impossible : ' + e.message + '\n'); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'original.html'), src);   /* utilisé par build.js (couleurs) */

function fail(msg) { console.error('\n✗ Construction impossible : ' + msg + '\n'); process.exit(1); }
function must(s, a, b, label) {
  const n = s.split(a).length - 1;
  if (n !== 1) fail('repère « ' + (label || a.slice(0, 50)) + ' » trouvé ' + n + ' fois au lieu d\'une (source/exercices/app.html a changé à cet endroit).');
  return s.replace(a, () => b);
}
function between(s, startMark, endMark, label) {
  const a = s.indexOf(startMark); if (a < 0) fail('début « ' + label + ' » introuvable');
  const b = s.indexOf(endMark, a); if (b < 0) fail('fin « ' + label + ' » introuvable');
  return [a, b];
}

/* ---- 1. données de démonstration (compte de démo « benjamin ») ---- */
const DATA_START = 'const VOCAB = {';
const DATA_END = '/* ============================================\n   STATE & STORAGE';
const [d0, d1] = between(src, DATA_START, DATA_END, 'données (VOCAB … GRAMMAR_CATEGORIES)');
const dataBlock = src.slice(d0, d1);
let data;
try {
  /* le bloc est évalué à part, sans accès à Node (pas de require, process, fichiers), avec une limite de temps */
  const vm = require('vm');
  const out = vm.runInNewContext(dataBlock + ';({VOCAB,NATURE,CONJ,CORE_THEMES,ADVANCED_THEMES,VERB_PRESENT,GRAMMAR_CATEGORIES})',
    Object.create(null), { timeout: 2000 });
  data = JSON.parse(JSON.stringify(out));   // données pures uniquement
} catch (e) { fail('le bloc de données ne se lit plus : ' + e.message); }
fs.writeFileSync(path.join(OUT, 'full_data.json'), JSON.stringify(data));

/* ---- 2. cours « Passé & futur » (contenu propre à chaque élève) ---- */
const TENSES_OPEN = '<div class="panel" id="panel-tenses">';
const STATS_OPEN = '<div class="panel" id="panel-stats">';
const t0 = src.indexOf(TENSES_OPEN); if (t0 < 0) fail('panneau « Passé & futur » introuvable');
const tInner0 = src.indexOf('\n', t0) + 1;
const st0 = src.indexOf(STATS_OPEN, tInner0); if (st0 < 0) fail('panneau « Mes stats » introuvable');
const tInner1 = src.lastIndexOf('</div>', st0);            // fermeture du panneau Passé & futur
const tensesInner = src.slice(tInner0, src.lastIndexOf('\n', tInner1) + 1);
fs.writeFileSync(path.join(OUT, 'tenses.html'), tensesInner);

/* ---- 3. module de progression (bloc HP assemblé depuis progress.js et game.js) ---- */
const HP_BEGIN = '<!-- HP:BEGIN', HP_END = '<!-- HP:END -->';
let hasHP = src.indexOf(HP_BEGIN) >= 0 && src.indexOf(HP_END) >= 0;
let progressJs;
if (hasHP) {
  const hb = src.slice(src.indexOf(HP_BEGIN), src.indexOf(HP_END));
  const m = hb.match(/<script>\n([\s\S]*?)\n<\/script>/);
  if (!m || m[1].indexOf('var HP = (function') < 0) fail('module HP présent mais illisible');
  progressJs = m[1];
} else {
  progressJs = fs.readFileSync(path.join(S, 'progress.js'), 'utf8');
}
fs.writeFileSync(path.join(OUT, 'progress.js'), progressJs);

/* ---- 4. gabarit élève ---- */
let st = src.slice(0, tInner0) + '<!--HP_TENSES-->\n' + src.slice(src.lastIndexOf('\n', tInner1) + 1);
const loader = [
  '/* Données propres à l\'élève — injectées par l\'espace de Maayane, uniquement depuis ses documents */',
  'const __D = window.__HP_DATA__ || {};',
  'const VOCAB = __D.VOCAB || {};',
  'const NATURE = __D.NATURE || {};',
  'const CONJ = __D.CONJ || [];',
  'const CORE_THEMES = __D.CORE_THEMES || Object.keys(VOCAB);',
  'const ADVANCED_THEMES = __D.ADVANCED_THEMES || [];',
  'const VERB_PRESENT = __D.VERB_PRESENT || {};',
  'const GRAMMAR_CATEGORIES = __D.GRAMMAR_CATEGORIES || [];',
  ''
].join('\n');
const [e0, e1] = between(st, DATA_START, DATA_END, 'données (gabarit)');
st = st.slice(0, e0) + loader + st.slice(e1);
st = st.replace(/<!-- saved from url=[^\n]*-->\n/, '');
st = st.replace(/<meta name="viewport"[^>]*>/, m => m + '\n<!--HP_HEAD-->');
if (st.indexOf('<!--HP_HEAD-->') < 0) fail('balise viewport introuvable');
st = st.replace(/<title>[^<]*<\/title>/, '<title><!--HP_TITLE--></title>');
st = must(st, "const STORAGE_KEY = 'hebrew_quiz_v2';", "const STORAGE_KEY = window.__HP_KEY__ || 'hebrew_quiz_v2';", 'STORAGE_KEY');
st = st.replace(/(\n\s*)const raw = localStorage\.getItem\(STORAGE_KEY\);/, "$1const raw = (typeof window.__HP_RAW__ === 'string') ? window.__HP_RAW__ : localStorage.getItem(STORAGE_KEY);");
if (st.indexOf('window.__HP_RAW__') < 0) fail('lecture des statistiques (loadData) introuvable');
st = must(st, '<div class="container">', '<div class="container">\n<!--HP_BAR-->', 'conteneur principal');
st = st.replace('Tes stats et préférences sont sauvegardées dans ton navigateur (localStorage). Elles ne quittent pas ton appareil.',
  'Tes stats sont enregistrées dans ton espace : ta professeure voit ta progression (XP, régularité, mots à revoir) pour adapter ses cours.');

if (!hasHP) {
  /* site sans module de progression : on branche celui du site de Maayane */
  const game = fs.readFileSync(path.join(S, 'game.js'), 'utf8');
  if (st.indexOf('__hpWas') < 0) {
    st = must(st, '  function record(e, verdict) {\n    var store, k;', '  function record(e, verdict) {\n    var __hpWas = window.HPG ? HPG.before(e) : false;\n    var store, k;', 'record()');
    st = must(st, '    else s.again++;\n    saveData();\n  }', '    else s.again++;\n    if (window.HPG) HPG.onFlash(e, verdict, __hpWas);\n    saveData();\n  }', 'record() fin');
  }
  const i = st.lastIndexOf('</body>'); if (i < 0) fail('</body> introuvable');
  st = st.slice(0, i) + '<script>\n' + progressJs + '\n</script>\n<script>\n' + game + '\ntry { HPG.install(); } catch (e) { console.error("HPG", e); }\n</script>\n' + st.slice(i);
}
fs.writeFileSync(path.join(OUT, 'student-template.html'), st);
console.log('✓ gabarit élève', (st.length / 1024).toFixed(0) + ' Ko · ' + Object.keys(data.VOCAB).length + ' thèmes de démo · exercices de source/exercices/app.html');
