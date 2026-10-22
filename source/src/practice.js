/* =====================================================================
   HPX — exercices « Mot ↔ définition » et « Phrase à compléter ».
   Injecté dans l'espace élève (iframe) par app.js : ne dépend pas du site de Benjamin.
   Lit le vocabulaire de l'élève (window.__HP_DATA__.VOCAB) : chaque mot est
   [hébreu, français, hébreu avec nikoud, définition en hébreu, phrase d'exemple].
   ===================================================================== */
(function () {
  'use strict';
  var NIK = /[֑-ׇ]/g;
  var data = window.__HP_DATA__ || {}, VOCAB = data.VOCAB || {};
  var words = [];
  Object.keys(VOCAB).forEach(function (t) {
    (VOCAB[t] || []).forEach(function (e) {
      if (!e || !e[0]) return;
      words.push({ he: e[0], fr: e[1] || '', voc: e[2] || e[0], def: e[3] || '', ex: e[4] || '', theme: t });
    });
  });
  function bare(s) { return String(s || '').replace(NIK, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* repère le mot dans la phrase, avec ou sans nikoud, et le remplace par un trou */
  function blank(w) {
    if (!w.ex) return null;
    var target = bare(w.voc || w.he).trim(); if (!target) return null;
    var re = new RegExp(target.split('').map(function (ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\u0591-\\u05C7]*'; }).join(''));
    var m = w.ex.match(re);
    if (!m) return null;
    return { before: w.ex.slice(0, m.index), after: w.ex.slice(m.index + m[0].length) };
  }
  var defs = words.filter(function (w) { return w.def; });
  var clozes = words.filter(function (w) { return blank(w); });
  if (defs.length < 4 && clozes.length < 4) return;   /* pas encore assez de matière : le bouton reste caché */

  /* ---------- voix ---------- */
  var voice = null;
  function pickVoice() {
    try { var v = speechSynthesis.getVoices(); voice = v.filter(function (x) { return /^he|^iw/i.test(x.lang); })[0] || null; } catch (e) {}
  }
  try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
  function say(t) {
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t); u.lang = 'he-IL'; if (voice) u.voice = voice; u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- interface ---------- */
  var css = '.hpx{position:fixed;inset:0;z-index:9999;background:var(--bg,#f6f7fb);overflow-y:auto;font-family:var(--font-ui,system-ui,sans-serif);color:var(--ink,#222)}' +
    '.hpx-in{max-width:620px;margin:0 auto;padding:16px 16px 40px}' +
    '.hpx-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}' +
    '.hpx-top b{font:800 18px var(--font-display,inherit)}' +
    '.hpx button{font:inherit;cursor:pointer}' +
    '.hpx .x{border:1.5px solid var(--line-strong,#ccc);background:var(--paper,#fff);border-radius:999px;padding:7px 14px;font-weight:700;color:var(--ink-soft,#555)}' +
    '.hpx-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}' +
    '.hpx-modes button{border:1.5px solid var(--line,#ddd);background:var(--paper,#fff);border-radius:14px;padding:12px 10px;font-weight:700;color:var(--ink-soft,#555)}' +
    '.hpx-modes button.on{border-color:var(--accent,#6d4aff);background:var(--accent-tint,#eee9ff);color:var(--accent,#6d4aff)}' +
    '.hpx-modes button:disabled{opacity:.45;cursor:default}' +
    '.hpx-card{background:var(--paper,#fff);border:1px solid var(--line,#e5e5e5);border-radius:22px;padding:22px 18px;box-shadow:var(--shadow-card,0 10px 30px -20px rgba(0,0,0,.3))}' +
    '.hpx-meta{display:flex;justify-content:space-between;font-size:13px;color:var(--muted,#888);font-weight:700;margin-bottom:12px}' +
    '.hpx-q{direction:rtl;text-align:right;font:600 24px/1.5 var(--font-he,serif);min-height:60px}' +
    '.hpx-q .gap{display:inline-block;min-width:80px;border-bottom:3px solid var(--accent,#6d4aff);margin:0 4px}' +
    '.hpx-q .gap.ok{border-color:transparent;color:var(--olive,#188a5c)}' +
    '.hpx-say{border:0;background:var(--accent-tint,#eee9ff);color:var(--accent,#6d4aff);border-radius:999px;padding:6px 12px;font-weight:700;font-size:13px;margin-top:8px}' +
    '.hpx-ch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}' +
    '.hpx-ch button{direction:rtl;border:1.5px solid var(--line-strong,#ccc);background:var(--paper,#fff);border-radius:16px;padding:14px 10px;font:700 21px var(--font-he,serif);color:var(--ink,#222)}' +
    '.hpx-ch button.good{border-color:var(--olive,#188a5c);background:var(--mint,#ddf6ea);color:var(--olive,#188a5c)}' +
    '.hpx-ch button.bad{border-color:var(--bad,#d93a45);background:var(--bad-tint,#ffe5e7);color:var(--bad,#d93a45)}' +
    '.hpx-fb{margin-top:16px;font-size:15px;line-height:1.5;min-height:24px}.hpx-fb .he{font-family:var(--font-he,serif);font-weight:700}' +
    '.hpx-next{display:block;width:100%;margin-top:14px;border:0;border-radius:999px;padding:14px;font-weight:800;background:linear-gradient(135deg,var(--accent,#6d4aff),var(--accent-2,#b86cf2));color:var(--on-accent,#fff)}' +
    '.hpx-end{text-align:center}.hpx-end .big{font:900 54px var(--font-display,inherit);color:var(--accent,#6d4aff)}' +
    '@media(max-width:420px){.hpx-q{font-size:21px}.hpx-ch button{font-size:19px}}';
  var root = null, mode = defs.length >= 4 ? 'def' : 'cloze', serie = [], i = 0, score = 0, answered = false;

  function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  /* 3 mauvaises réponses : de préférence du même thème et de la même nature de mot */
  function choices(w) {
    var same = shuffle(words.filter(function (x) { return x.theme === w.theme && bare(x.voc) !== bare(w.voc); }));
    var other = shuffle(words.filter(function (x) { return x.theme !== w.theme && bare(x.voc) !== bare(w.voc); }));
    var seen = {}, out = [];
    same.concat(other).forEach(function (x) { var k = bare(x.voc); if (out.length < 3 && !seen[k]) { seen[k] = 1; out.push(x); } });
    return shuffle(out.concat([w]));
  }
  function start(m) {
    mode = m;
    var pool = m === 'def' ? defs : clozes;
    serie = shuffle(pool).slice(0, Math.min(10, pool.length)); i = 0; score = 0;
    render();
  }
  function render() {
    if (!root) return;
    var body;
    if (i >= serie.length) {
      body = '<div class="hpx-card hpx-end"><div class="big">' + score + ' / ' + serie.length + '</div>' +
        '<p>' + (score === serie.length ? 'Parfait ! 🎉' : score >= serie.length * 0.7 ? 'Très bien ! 💪' : 'Continue, ça vient ! 🌱') + '</p>' +
        '<button class="hpx-next" data-again>Rejouer</button></div>';
    } else {
      var w = serie[i], q;
      if (mode === 'def') q = '<div class="hpx-q">' + esc(w.def) + '</div><button class="hpx-say" data-say="' + esc(w.def) + '">🔊 Écouter</button>';
      else { var b = blank(w); q = '<div class="hpx-q">' + esc(b.before) + '<span class="gap" id="hpx-gap">&nbsp;</span>' + esc(b.after) + '</div><button class="hpx-say" data-say="' + esc(w.ex) + '">🔊 Écouter la phrase</button>'; }
      body = '<div class="hpx-card"><div class="hpx-meta"><span>' + (mode === 'def' ? 'Quel mot correspond à la définition ?' : 'Quel mot manque ?') + '</span><span>' + (i + 1) + ' / ' + serie.length + ' · ✓ ' + score + '</span></div>' + q +
        '<div class="hpx-ch">' + choices(w).map(function (c) { return '<button data-c="' + esc(bare(c.voc)) + '" lang="he">' + esc(c.voc) + '</button>'; }).join('') + '</div>' +
        '<div class="hpx-fb" id="hpx-fb"></div></div>';
    }
    root.querySelector('.hpx-body').innerHTML = body;
    root.querySelectorAll('.hpx-modes button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === mode); });
    answered = false;
  }
  function answer(btn) {
    if (answered) return; answered = true;
    var w = serie[i], ok = btn.dataset.c === bare(w.voc);
    if (ok) score++;
    root.querySelectorAll('.hpx-ch button').forEach(function (b) {
      if (b.dataset.c === bare(w.voc)) b.classList.add('good'); else if (b === btn) b.classList.add('bad');
      b.disabled = true;
    });
    var gap = root.querySelector('#hpx-gap'); if (gap) { gap.textContent = w.voc; gap.classList.add('ok'); }
    root.querySelector('#hpx-fb').innerHTML = (ok ? '✅ Bravo ! ' : '❌ C’était ') + '<span class="he" lang="he" dir="rtl">' + esc(w.voc) + '</span> = ' + esc(w.fr) +
      '<button class="hpx-next" data-next>' + (i + 1 < serie.length ? 'Suivant →' : 'Voir mon score') + '</button>';
    say(w.voc);
  }
  function open() {
    if (root) return;
    if (!document.getElementById('hpx-css')) { var s = document.createElement('style'); s.id = 'hpx-css'; s.textContent = css; document.head.appendChild(s); }
    root = document.createElement('div'); root.className = 'hpx';
    root.innerHTML = '<div class="hpx-in"><div class="hpx-top"><b>🧩 Définitions & phrases</b><button class="x" data-close>✕ Fermer</button></div>' +
      '<div class="hpx-modes"><button data-m="def"' + (defs.length < 4 ? ' disabled' : '') + '>Mot ↔ définition</button><button data-m="cloze"' + (clozes.length < 4 ? ' disabled' : '') + '>Phrase à compléter</button></div>' +
      '<div class="hpx-body"></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-close')) close();
      else if (t.dataset.m) start(t.dataset.m);
      else if (t.dataset.c != null) answer(t);
      else if (t.hasAttribute('data-next')) { i++; render(); }
      else if (t.hasAttribute('data-again')) start(mode);
      else if (t.dataset.say) say(t.dataset.say);
    });
    start(mode);
  }
  function close() { if (root) { root.remove(); root = null; } try { speechSynthesis.cancel(); } catch (e) {} }
  window.HPX = { open: open, close: close };
  function showBtn() { var b = document.getElementById('hp-px-btn'); if (b) b.hidden = false; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBtn); else showBtn();
})();
