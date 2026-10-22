/* =====================================================================
   HPX — exercices « Mot ↔ définition » et « Phrase à compléter ».
   Injecté dans l'espace élève (iframe) par app.js : ne dépend pas du site de Benjamin.
   Lit le vocabulaire de l'élève (window.__HP_DATA__.VOCAB) : chaque mot est
   [hébreu, français, hébreu avec nikoud, définition en hébreu, phrase d'exemple].
   ===================================================================== */
(function () {
  'use strict';
  var NIK = /[\u0591-\u05BD\u05BF-\u05C7]/g;
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
  var ready = false;
  var defs = words.filter(function (w) { return w.def; });
  var clozes = words.filter(function (w) { return blank(w); });

  /* ---------- voix ---------- */
  var voice = null;
  function pickVoice() {
    try { var v = speechSynthesis.getVoices(); voice = v.filter(function (x) { return /^he|^iw/i.test(x.lang); })[0] || null; } catch (e) {}
  }
  try { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); setTimeout(pickVoice, 1500); } catch (e) {}
  function hasVoice() { return (window.HPS && HPS.ok && HPS.ok()) || !!voice; }
  /* même moteur que le site (HPS) quand il est là : il gère les caprices de Safari et Chrome */
  function say(t, manual) {
    if (!hasVoice()) { if (manual) noVoice(); return; }
    if (window.HPS && HPS.ok && HPS.ok()) { HPS.speak(t); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t); u.lang = 'he-IL'; if (voice) u.voice = voice; u.rate = 0.9;
      setTimeout(function () { speechSynthesis.speak(u); }, 60);
    } catch (e) {}
  }
  function noVoice() {
    var el = root && root.querySelector('.hpx-novoice'); if (!el) return;
    el.hidden = false;
  }

  /* ---------- interface ---------- */
  var css = '.hpx{position:fixed;inset:0;z-index:9999;background:var(--bg,#f6f7fb);overflow-y:auto;font-family:var(--font-ui,system-ui,sans-serif);color:var(--ink,#222)}' +
    '.hpx-in{max-width:620px;margin:0 auto;padding:16px 16px 40px}' +
    '.hpx-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}' +
    '.hpx-top b{font:800 18px var(--font-display,inherit)}' +
    '.hpx button{font:inherit;cursor:pointer}' +
    '.hpx .x{border:1.5px solid var(--line-strong,#ccc);background:var(--paper,#fff);border-radius:999px;padding:7px 14px;font-weight:700;color:var(--ink-soft,#555)}' +
    '.hpx-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}' +
    '.hpx-q.big{font-size:36px;text-align:center}.hpx-ch.defs{grid-template-columns:1fr}.hpx-ch.defs button{font-size:17px;font-weight:600;text-align:right;padding:12px 14px}' +
    '.hpx-ch button small.tr{display:block;direction:ltr;font:600 12px var(--font-ui,sans-serif);color:var(--muted,#888);margin-top:4px}' +
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
    '.hpx-novoice{background:var(--peach,#ffedde);border-radius:16px;padding:12px 14px;font-size:13.5px;line-height:1.55;margin-bottom:14px}' +
    '.hpx-end{text-align:center}.hpx-end .big{font:900 54px var(--font-display,inherit);color:var(--accent,#6d4aff)}' +
    '@media(max-width:420px){.hpx-q{font-size:21px}.hpx-ch button{font-size:19px}}';
  var root = null, mode = defs.length >= 4 ? 'def' : 'cloze', serie = [], i = 0, score = 0, answered = false;

  function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  /* 3 mauvaises réponses : de préférence du même thème et de la même nature de mot */
  /* 3 mauvaises réponses : de préférence du même thème */
  function others(w, pool, n) {
    var same = shuffle(pool.filter(function (x) { return x.theme === w.theme && bare(x.voc) !== bare(w.voc); }));
    var diff = shuffle(pool.filter(function (x) { return x.theme !== w.theme && bare(x.voc) !== bare(w.voc); }));
    var seen = {}, out = [];
    same.concat(diff).forEach(function (x) { var k = bare(x.voc); if (out.length < n && !seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  /* l'intrus : 3 mots d'un même thème + 1 mot d'un autre thème */
  var oddThemes = Object.keys(VOCAB).filter(function (t) {
    var seen = {}; (VOCAB[t] || []).forEach(function (e) { if (e && e[0]) seen[bare(e[2] || e[0])] = 1; });
    return Object.keys(seen).length >= 3;
  });
  var oddOk = oddThemes.length >= 2;
  var MODES = {
    def: { n: defs.length, label: 'Définition → mot', ask: 'Quel mot correspond à la définition ?' },
    rdef: { n: defs.length, label: 'Mot → définition', ask: 'Quelle est la bonne définition ?' },
    cloze: { n: clozes.length, label: 'Phrase à compléter', ask: 'Quel mot manque ?' },
    odd: { n: oddOk ? 99 : 0, label: 'L’intrus', ask: 'Quel mot n’est pas de la même famille que les autres ?' }
  };
  function can(m) { return MODES[m].n >= 4; }
  ready = can('def') || can('cloze') || can('odd');
  /* une question = { w : la bonne réponse, ch : 4 choix [{key, he}], q : html de l'énoncé, say : texte à écouter } */
  function make(m, w) {
    if (m === 'def') return { w: w, q: '<div class="hpx-q">' + esc(w.def) + '</div>', say: w.def, sayLbl: 'Écouter la définition',
      ch: shuffle(others(w, words, 3).concat([w])).map(function (c) { return { key: bare(c.voc), he: c.voc }; }), good: bare(w.voc) };
    if (m === 'rdef') return { w: w, q: '<div class="hpx-q big" lang="he">' + esc(w.voc) + '</div>', say: w.voc, sayLbl: 'Écouter le mot', small: true,
      ch: shuffle(others(w, defs, 3).concat([w])).map(function (c) { return { key: bare(c.voc), he: c.def }; }), good: bare(w.voc) };
    if (m === 'cloze') { var b = blank(w); return { w: w, gap: true, q: '<div class="hpx-q">' + esc(b.before) + '<span class="gap" id="hpx-gap">&nbsp;</span>' + esc(b.after) + '</div>', say: w.ex, sayLbl: 'Écouter la phrase',
      ch: shuffle(others(w, words, 3).concat([w])).map(function (c) { return { key: bare(c.voc), he: c.voc }; }), good: bare(w.voc) }; }
    /* intrus */
    var th = shuffle(oddThemes), A = th[0], B = th[1];
    var famA = shuffle(words.filter(function (x) { return x.theme === A; })), three = [], seen = {};
    famA.forEach(function (x) { var k = bare(x.voc); if (three.length < 3 && !seen[k]) { seen[k] = 1; three.push(x); } });
    var odd = shuffle(words.filter(function (x) { return x.theme === B && !seen[bare(x.voc)]; }))[0];
    return { w: odd, odd: true, fam: A, q: '', ch: shuffle(three.concat([odd])).map(function (c) { return { key: bare(c.voc), he: c.voc, fr: c.fr }; }), good: bare(odd.voc) };
  }
  function start(m) {
    if (!can(m)) return;
    mode = m;
    var pool = m === 'cloze' ? clozes : m === 'odd' ? null : defs;
    serie = pool ? shuffle(pool).slice(0, Math.min(10, pool.length)).map(function (w) { return make(m, w); })
      : Array.apply(null, Array(10)).map(function () { return make('odd'); });
    i = 0; score = 0;
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
      var Q = serie[i];
      body = '<div class="hpx-card"><div class="hpx-meta"><span>' + MODES[mode].ask + '</span><span>' + (i + 1) + ' / ' + serie.length + ' · ✓ ' + score + '</span></div>' +
        Q.q + (Q.say ? '<button class="hpx-say" data-hpxsay="' + esc(Q.say) + '">🔊 ' + Q.sayLbl + '</button>' : '') +
        '<div class="hpx-ch' + (Q.small ? ' defs' : '') + (Q.odd ? ' odd' : '') + '">' + Q.ch.map(function (c) { return '<button data-c="' + esc(c.key) + '" lang="he">' + esc(c.he) + '</button>'; }).join('') + '</div>' +
        '<div class="hpx-fb" id="hpx-fb"></div></div>';
    }
    root.querySelector('.hpx-body').innerHTML = body;
    root.querySelectorAll('.hpx-modes button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === mode); });
    answered = false;
  }
  function answer(btn) {
    if (answered) return; answered = true;
    var Q = serie[i], w = Q.w, ok = btn.dataset.c === Q.good;
    if (ok) score++;
    root.querySelectorAll('.hpx-ch button').forEach(function (b, k) {
      if (b.dataset.c === Q.good) b.classList.add('good'); else if (b === btn) b.classList.add('bad');
      if (Q.odd) b.insertAdjacentHTML('beforeend', '<small class="tr">' + esc(Q.ch[k].fr) + '</small>');
      b.disabled = true;
    });
    var gap = root.querySelector('#hpx-gap'); if (gap) { gap.textContent = w.voc; gap.classList.add('ok'); }
    var fb = Q.odd
      ? (ok ? '✅ Bravo ! ' : '❌ ') + 'L’intrus : <span class="he" lang="he" dir="rtl">' + esc(w.voc) + '</span> (' + esc(w.fr) + ', thème « ' + esc(w.theme) + ' »). Les autres : « ' + esc(Q.fam) + ' ».'
      : (ok ? '✅ Bravo ! ' : '❌ C’était ') + '<span class="he" lang="he" dir="rtl">' + esc(w.voc) + '</span> = ' + esc(w.fr) + (mode === 'rdef' ? '<br><span class="he" lang="he" dir="rtl">' + esc(w.def) + '</span>' : '');
    root.querySelector('#hpx-fb').innerHTML = fb + '<button class="hpx-next" data-next>' + (i + 1 < serie.length ? 'Suivant →' : 'Voir mon score') + '</button>';
    say(w.voc);
  }
  function open(m) {
    if (root || !ready) return;
    mode = m && can(m) ? m : ['def', 'cloze', 'odd'].filter(can)[0];
    if (!document.getElementById('hpx-css')) { var s = document.createElement('style'); s.id = 'hpx-css'; s.textContent = css; document.head.appendChild(s); }
    root = document.createElement('div'); root.className = 'hpx';
    root.innerHTML = '<div class="hpx-in"><div class="hpx-top"><b>🧩 Jeux de mots</b><button class="x" data-close>✕ Fermer</button></div>' +
      '<div class="hpx-modes">' + Object.keys(MODES).map(function (k) { return '<button data-m="' + k + '"' + (can(k) ? '' : ' disabled') + '>' + MODES[k].label + '</button>'; }).join('') + '</div>' +
      '<div class="hpx-novoice" hidden><b>🔇 Pas de voix hébraïque sur cet appareil</b>, le son ne peut pas fonctionner. Pour l’activer :<br>' +
      '• iPhone / iPad : Réglages › Accessibilité › Contenu énoncé › Voix › Hébreu (télécharger)<br>' +
      '• Android : Paramètres › Synthèse vocale (Google) › Installer les données vocales › Hébreu<br>' +
      '• Ordinateur : ouvre le site dans Chrome ou Edge.</div>' +
      '<div class="hpx-body"></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-close')) close();
      else if (t.dataset.m) start(t.dataset.m);
      else if (t.dataset.c != null) answer(t);
      else if (t.hasAttribute('data-next')) { i++; render(); }
      else if (t.hasAttribute('data-again')) start(mode);
      else if (t.dataset.hpxsay) say(t.dataset.hpxsay, true);
    });
    start(mode);
  }
  function close() { if (root) { root.remove(); root = null; } try { speechSynthesis.cancel(); } catch (e) {} }
  window.HPX = { open: function () { open(); }, close: close };
  /* cartes dans « Jeux courts » (onglet Réviser), à côté des jeux du site */
  function card(m, ic, title, txt, n, soon) {
    var ok = n >= 4;
    return '<button type="button" class="rv-game" data-hpx="' + m + '"' + (ok ? '' : ' disabled style="opacity:.55;cursor:default"') + '><span class="rv-ic" aria-hidden="true">' + ic + '</span><b>' + title + '</b>' +
      '<span>' + txt + '</span><small>' + (ok ? '🔊 Avec audio' + (n < 99 ? ' · ' + n + ' mots' : '') : soon) + '</small></button>';
  }
  function addCards() {
    document.querySelectorAll('.rv-games').forEach(function (g) {
      if (g.querySelector('[data-hpx]')) return;
      var soon = 'Bientôt : ta professeure les prépare';
      g.insertAdjacentHTML('beforeend',
        card('odd', '🕵️', 'L’intrus', '4 mots, 3 de la même famille : trouve celui qui n’a rien à faire là. 10 questions.', MODES.odd.n, 'Il faut au moins deux thèmes') +
        card('def', '🧩', 'Mot ↔ définition', 'Une définition simple en hébreu → le mot, ou le mot → sa définition. 10 questions.', defs.length, soon) +
        card('cloze', '✍️', 'Phrase à compléter', 'Une phrase en hébreu, un mot manque : lequel ? 10 questions.', clozes.length, soon));
    });
  }
  function init() {
    var b = document.getElementById('hp-px-btn'); if (b && ready) b.hidden = false;
    addCards();
    /* l'onglet Réviser se redessine : on remet les cartes à chaque fois */
    new MutationObserver(function () { addCards(); }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('[data-hpx]'); if (c && !c.disabled) open(c.dataset.hpx); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
