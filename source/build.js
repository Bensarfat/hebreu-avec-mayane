const fs = require('fs'), path = require('path');
const S = path.join(__dirname, 'src'), B = path.join(__dirname, 'build'), D = path.join(__dirname, '..');
fs.mkdirSync(D, { recursive: true });
const orig = fs.readFileSync(path.join(S, 'original.html'), 'utf8').split('\n');
const tokens = orig.slice(10, 206).join('\n');   // :root + dark mode
const bodyBg = orig.slice(214, 221).join('\n');  // fond dégradé
const rd = f => fs.readFileSync(path.join(S, f), 'utf8');
const j = x => JSON.stringify(x).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const data = JSON.parse(fs.readFileSync(path.join(S, 'full_data.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(B, 'student-template.html'), 'utf8');
const tenses = fs.readFileSync(path.join(B, 'tenses.html'), 'utf8');
const html = `<meta charset="utf-8">
<title>Hébreu avec Mayane</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${tokens}
${bodyBg}
${rd('shell.css')}
</style>
<div id="app"></div>
<script>
var TPL = ${j(tpl)};
var TENSES = ${j(tenses)};
var DEMO_DATA = ${j(data)};
</script>
<script>
${rd('progress.js')}
${rd('backend.js')}
${rd('analyse.js')}
${rd('home.js')}
${rd('app.js')}
</script>
`;
fs.writeFileSync(path.join(D, 'index.html'), html);

console.log('index.html', (html.length / 1024).toFixed(0) + ' Ko');
