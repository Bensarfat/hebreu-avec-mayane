const fs = require('fs'), path = require('path');
const S = __dirname, OUT = path.join(S, '..', 'build');
fs.mkdirSync(OUT, { recursive: true });
const lines = fs.readFileSync(path.join(S, 'original.html'), 'utf8').split('\n');
const L = n => n - 1; // 1-based -> index
const progress = fs.readFileSync(path.join(S, 'progress.js'), 'utf8');
const game = fs.readFileSync(path.join(S, 'game.js'), 'utf8');

function must(s, a, b) { if (s.split(a).length !== 2) throw new Error('anchor not unique: ' + a.slice(0, 60)); return s.replace(a, b); }

function common(html) {
  // crochet flashcards : record() est privé, on l'instrumente
  html = must(html, '  function record(e, verdict) {\n    var store, k;',
    '  function record(e, verdict) {\n    var __hpWas = window.HPG ? HPG.before(e) : false;\n    var store, k;');
  html = must(html, '    else s.again++;\n    saveData();\n  }',
    '    else s.again++;\n    if (window.HPG) HPG.onFlash(e, verdict, __hpWas);\n    saveData();\n  }');
  html = must(html, '\n</script>\n\n\n\n</body></html>',
    '\n</script>\n<script>\n' + progress + '\n</script>\n<script>\n' + game + '\ntry { HPG.install(); } catch (e) { console.error("HPG", e); }\n</script>\n</body></html>');
  return html;
}

/* ---- 1. site perso de Benjamin : mêmes données, + progression ---- */
let ben = common(lines.join('\n'));
ben = ben.replace('<!-- saved from url=(0058)file:///Users/benjaminsarfati/Downloads/quiz_hebreu_2.html -->\n', '');
fs.writeFileSync(path.join(OUT, 'benjamin-index.html'), ben);

/* ---- 2. gabarit élève : données et cours chargés par élève ---- */
const tensesInner = lines.slice(L(3057), L(4342) + 1).join('\n');
fs.writeFileSync(path.join(OUT, 'tenses.html'), tensesInner);
const loader = [
  '/* Données propres à l\'élève — injectées par l\'espace de Mayane, uniquement depuis ses PDF */',
  'const __D = window.__HP_DATA__ || {};',
  'const VOCAB = __D.VOCAB || {};',
  'const NATURE = __D.NATURE || {};',
  'const CONJ = __D.CONJ || [];',
  'const CORE_THEMES = __D.CORE_THEMES || Object.keys(VOCAB);',
  'const ADVANCED_THEMES = __D.ADVANCED_THEMES || [];',
  'const VERB_PRESENT = __D.VERB_PRESENT || {};',
  'const GRAMMAR_CATEGORIES = __D.GRAMMAR_CATEGORIES || [];'
].join('\n');
let st = [].concat(
  lines.slice(0, L(4468)),
  [loader],
  lines.slice(L(7046), L(3057)).length ? [] : [],
  lines.slice(L(7046))
);
// on reconstitue proprement : avant tenses | marqueur | entre tenses et data | loader | après data
st = [].concat(
  lines.slice(0, L(3057)),
  ['<!--HP_TENSES-->'],
  lines.slice(L(4343), L(4468)),
  [loader],
  lines.slice(L(7046))
).join('\n');
st = st.replace('<!-- saved from url=(0058)file:///Users/benjaminsarfati/Downloads/quiz_hebreu_2.html -->\n', '');
st = must(st, '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<!--HP_HEAD-->');
st = must(st, "const STORAGE_KEY = 'hebrew_quiz_v2';", "const STORAGE_KEY = window.__HP_KEY__ || 'hebrew_quiz_v2';");
st = must(st, '    const raw = localStorage.getItem(STORAGE_KEY);',
  "    const raw = (typeof window.__HP_RAW__ === 'string') ? window.__HP_RAW__ : localStorage.getItem(STORAGE_KEY);");
st = must(st, '<div class="container">', '<div class="container">\n<!--HP_BAR-->');
st = must(st, "Tes stats et préférences sont sauvegardées dans ton navigateur (localStorage). Elles ne quittent pas ton appareil.",
  "Tes stats sont enregistrées dans ton espace : ta professeure voit ta progression (XP, régularité, mots à revoir) pour adapter ses cours.");
st = must(st, '<title>Quiz d\'Hébreu · קויז עברית</title>', '<title><!--HP_TITLE--></title>');
st = common(st);
fs.writeFileSync(path.join(OUT, 'student-template.html'), st);
console.log('ben', ben.length, 'tpl', st.length, 'tenses', tensesInner.length);
