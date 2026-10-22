/* Construit le site publié :
   - index.html            : la page (accueil, connexion, espace de Maayane), légère
   - assets/student.*.txt  : l'espace élève, chargé seulement à l'ouverture d'un espace
   - assets/demo.*.json    : les données de démonstration, chargées seulement en mode démo
   Les noms contiennent une empreinte du contenu : le navigateur peut les garder en cache longtemps. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const S = path.join(__dirname, 'src'), B = path.join(__dirname, 'build'), D = path.join(__dirname, '..'), A = path.join(D, 'assets');
const origTxt = fs.readFileSync(path.join(S, 'original.html'), 'utf8').replace(/\r\n/g, '\n');
/* charte graphique reprise du site de Benjamin : jetons de couleur (clair + sombre) et fond */
const tStart = origTxt.indexOf(':root {'), tEnd = origTxt.indexOf('\n  html, body {', tStart);
if (tStart < 0 || tEnd < 0) { console.error('✗ jetons de couleur introuvables dans le site de Benjamin'); process.exit(1); }
const tokens = '  ' + origTxt.slice(tStart, tEnd);
const bg = origTxt.match(/  body \{\n    background-image:[\s\S]*?\n  \}/);
const bodyBg = bg ? bg[0] : '';
const rd = f => fs.readFileSync(path.join(S, f), 'utf8');
const j = x => JSON.stringify(x).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const hash = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 10);

/* fichiers chargés à la demande */
const tpl = fs.readFileSync(path.join(B, 'student-template.html'), 'utf8');
const demo = JSON.stringify({ data: JSON.parse(fs.readFileSync(path.join(B, 'full_data.json'), 'utf8')), tenses: fs.readFileSync(path.join(B, 'tenses.html'), 'utf8') });
fs.rmSync(A, { recursive: true, force: true });
fs.mkdirSync(A, { recursive: true });
const studentFile = 'assets/student.' + hash(tpl) + '.txt';
const demoFile = 'assets/demo.' + hash(demo) + '.json';
fs.writeFileSync(path.join(D, studentFile), tpl);
fs.writeFileSync(path.join(D, demoFile), demo);
/* images du site (source/src/img) : copiées avec une empreinte dans le nom */
const IMG = {};
const imgDir = path.join(S, 'img');
if (fs.existsSync(imgDir)) fs.readdirSync(imgDir).forEach(f => {
  const buf = fs.readFileSync(path.join(imgDir, f)), ext = path.extname(f), name = path.basename(f, ext);
  IMG[name] = 'assets/' + name + '.' + crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10) + ext;
  fs.writeFileSync(path.join(D, IMG[name]), buf);
});

/* empreinte de cette version (le site propose de recharger quand elle change) */
const BUILD = hash(tpl + demo + JSON.stringify(IMG) + ['progress.js', 'backend.js', 'analyse.js', 'backend-remote.js', 'home.js', 'agenda-ui.js', 'app.js', 'shell.css'].map(rd).join('') + fs.readFileSync(path.join(D, 'api', '_agenda.js'), 'utf8'));
fs.writeFileSync(path.join(D, 'version.json'), JSON.stringify({ build: BUILD }) + '\n');
const FONTS = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&family=Noto+Sans+Hebrew:wght@400;500;600;700&family=Noto+Color+Emoji&display=swap';
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7457f5"/><stop offset="1" stop-color="#b86cf2"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><text x="32" y="45" text-anchor="middle" font-family="Arial" font-weight="700" font-size="38" fill="#fff">מ</text></svg>');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Hébreu avec Maayane</title>
<meta name="description" content="Cours d'hébreu, en hébreu avec le soutien du français, avec Maayane : un espace de révision personnel pour chaque élève (vocabulaire, grammaire, quiz, flashcards).">
<meta name="theme-color" content="#7457f5">
<link rel="icon" href="${ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${FONTS}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${FONTS}"></noscript>
<style>
${tokens}
${bodyBg}
${rd('shell.css')}
</style>
</head>
<body>
<div id="app"></div>
<script>
var ASSETS = ${j({ student: studentFile, demo: demoFile, build: BUILD, img: IMG })};
</script>
<script>
${rd('progress.js')}
${fs.readFileSync(path.join(D, 'api', '_agenda.js'), 'utf8')}
${rd('backend.js')}
${rd('analyse.js')}
${rd('backend-remote.js')}
${rd('home.js')}
${rd('agenda-ui.js')}
${rd('app.js')}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(D, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' Ko · ' + studentFile + ' ' + (tpl.length / 1024).toFixed(0) + ' Ko · ' + demoFile + ' ' + (demo.length / 1024).toFixed(0) + ' Ko');
