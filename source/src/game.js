/* =====================================================================
   HPG — gamification branchée sur le site de révision (XP, niveaux,
   séries, badges, toasts) + onglet « Mes stats » enrichi.
   S'appuie sur HP (progress.js) et sur les globales du site :
   storage, saveData, updateWordStat, VOCAB.
   ===================================================================== */
var HPG = (function () {
  'use strict';
  var P, combo = 0, lastLevel = 1, syncTimer = null;

  function prog() {
    if (!storage.progress || typeof storage.progress !== 'object') storage.progress = {};
    P = storage.progress;
    if (typeof P.xp !== 'number') P.xp = 0;
    if (!P.days) P.days = {};
    if (!P.badges) P.badges = {};
    if (!P.goal) P.goal = 60;
    if (typeof P.bestCombo !== 'number') P.bestCombo = 0;
    if (!P.backfilled) {
      /* XP rétroactif : les réponses déjà enregistrées avant la mise en place des points */
      var t = HP.totalsFrom(storage, VOCAB), X = HP.XP;
      P.xp += t.qOk * X.quizOk + t.qKo * X.quizKo + t.fK * X.flashKnown + t.fA * X.flashAgain +
              t.fS * X.flashSoft + t.cK * X.conjKnown + t.cA * X.conjAgain + t.cS * X.conjSoft +
              t.mastered * X.mastered;
      P.backfilled = HP.dayKey();
    }
    return P;
  }

  function today() {
    var k = HP.dayKey();
    return P.days[k] || (P.days[k] = HP.emptyDay());
  }

  /* ---------- toasts & célébrations ---------- */
  function toastBox() {
    var b = document.getElementById('hp-toasts');
    if (!b) { b = document.createElement('div'); b.id = 'hp-toasts'; document.body.appendChild(b); }
    return b;
  }
  function toast(html, kind) {
    var el = document.createElement('div');
    el.className = 'hp-toast ' + (kind || '');
    el.innerHTML = html;
    toastBox().appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, kind === 'xp' ? 900 : 2600);
    setTimeout(function () { el.remove(); }, kind === 'xp' ? 1300 : 3000);
  }
  function celebrate(title, sub, big) {
    var ov = document.createElement('div');
    ov.className = 'hp-cele';
    ov.innerHTML = '<div class="hp-cele-card"><div class="hp-cele-big">' + big + '</div><h3>' + title + '</h3><p>' + sub +
      '</p><button type="button" class="btn primary">Continuer</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
    document.body.appendChild(ov);
    var conf = '';
    for (var i = 0; i < 28; i++) {
      conf += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:' + (Math.random() * .5).toFixed(2) +
        's;background:var(' + ['--accent', '--accent-2', '--olive', '--gold', '--rose', '--sky'][i % 6] + ')"></i>';
    }
    ov.insertAdjacentHTML('beforeend', '<div class="hp-confetti">' + conf + '</div>');
  }

  /* ---------- gain d'XP ---------- */
  function gain(n, fields) {
    prog();
    var d = today(), before = d.xp >= P.goal;
    for (var f in fields) d[f] = (d[f] || 0) + fields[f];
    d.xp += n; P.xp += n;
    var h = new Date().getHours();
    if (h < 8) P.early = true;
    if (h >= 22) P.night = true;
    if (!before && d.xp >= P.goal) {
      d.goal = 1; d.xp += HP.XP.goal; P.xp += HP.XP.goal;
      toast('🎯 <b>Objectif du jour atteint</b> · +' + HP.XP.goal + ' XP bonus', 'goal');
    }
    toast('+' + n + ' XP', 'xp');
    var L = HP.levelInfo(P.xp);
    if (L.level > lastLevel) {
      celebrate('Niveau ' + L.level + ' !', L.title + ' · <span class="hp-he">' + L.titleHe + '</span> — continue comme ça.',
        '<span class="hp-he">' + L.letter + '</span>');
    }
    lastLevel = L.level;
    checkBadges();
    hud();
  }

  function onAnswer(ok) {
    if (ok) {
      combo++;
      if (combo > P.bestCombo) P.bestCombo = combo;
      if (combo % 10 === 0) {
        P.xp += HP.XP.combo; today().xp += HP.XP.combo;
        toast('⚡ <b>' + combo + ' bonnes réponses d\'affilée</b> · +' + HP.XP.combo + ' XP', 'goal');
      }
    } else combo = 0;
  }

  function masteredNow(k) {
    var q = storage.wordStats && storage.wordStats[k], f = storage.flash && storage.flash[k];
    var qm = q && ((q.correct >= 3 && q.wrong === 0) || (q.seen >= 4 && q.correct / q.seen >= 0.8));
    var fm = f && ((f.known >= 2 && !f.again && !f.soft) || (f.seen >= 4 && f.known / f.seen >= 0.8));
    return !!(qm || fm);
  }

  function checkBadges() {
    var totals = HP.totalsFrom(storage, VOCAB), themes = HP.themeMastery(storage, VOCAB);
    var c = HP.badgeContext(P, totals, themes);
    HP.BADGES.forEach(function (b) {
      if (!P.badges[b.id] && b.test(c)) {
        P.badges[b.id] = HP.dayKey();
        toast('<span style="font-size:22px">' + b.icon + '</span> <span><b>Badge débloqué</b><br>' + HP.esc(b.name) + '</span>', 'badge');
      }
    });
  }

  /* ---------- crochets appelés par le site ---------- */
  function before(e) {
    if (!e || e.conj) return false;
    return masteredNow(e[0] + '|' + e[1]);
  }
  function onFlash(e, verdict, wasMastered) {
    prog();
    var conj = e && e.conj, X = HP.XP, n, f = {};
    if (conj) {
      n = verdict === 'known' ? X.conjKnown : verdict === 'soft' ? X.conjSoft : X.conjAgain;
      f[verdict === 'known' ? 'cK' : verdict === 'soft' ? 'cS' : 'cA'] = 1;
    } else {
      n = verdict === 'known' ? X.flashKnown : verdict === 'soft' ? X.flashSoft : X.flashAgain;
      f[verdict === 'known' ? 'fK' : verdict === 'soft' ? 'fS' : 'fA'] = 1;
      if (!wasMastered && masteredNow(e[0] + '|' + e[1])) { n += X.mastered; toast('📗 Mot maîtrisé : <span class="hp-he">' + HP.esc(e[0]) + '</span>', 'goal'); }
    }
    onAnswer(verdict === 'known');
    gain(n, f);
  }
  function onQuiz(item, result, wasMastered) {
    prog();
    var ok = result === 'correct', n = ok ? HP.XP.quizOk : HP.XP.quizKo;
    if (ok && !wasMastered && masteredNow(item.he + '|' + item.fr)) { n += HP.XP.mastered; toast('📗 Mot maîtrisé : <span class="hp-he">' + HP.esc(item.he) + '</span>', 'goal'); }
    onAnswer(ok);
    gain(n, ok ? { qOk: 1 } : { qKo: 1 });
  }

  /* ---------- synchronisation vers l'espace de la prof ---------- */
  function sync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      try {
        if (window.parent && window.parent !== window && window.parent.HPB && window.__HP_STUDENT__) {
          window.parent.HPB.pushProgress(window.__HP_STUDENT__, HP.summarize(storage, prog(), VOCAB), JSON.parse(JSON.stringify(storage)));
        }
      } catch (e) { /* hors espace élève */ }
    }, 1200);
  }

  /* ---------- bandeau en-tête ---------- */
  function hud() {
    var el = document.getElementById('hp-hud');
    if (!el) return;
    var L = HP.levelInfo(P.xp), st = HP.streaks(P.days), d = P.days[HP.dayKey()] || HP.emptyDay();
    el.innerHTML =
      '<button type="button" class="hp-hud-lv" data-go="stats" title="Voir ma progression"><span class="hp-he">' + L.letter + '</span>Niv. ' + L.level +
        '<i><b style="width:' + L.pct + '%"></b></i></button>' +
      '<span class="hp-hud-pill" title="XP total">⭐ <b>' + HP.fmt(P.xp) + '</b> XP</span>' +
      '<span class="hp-hud-pill" title="Jours de révision d\'affilée">' + (st.cur ? '🔥' : '·') + ' <b>' + st.cur + '</b> j</span>' +
      '<span class="hp-hud-pill' + (d.xp >= P.goal ? ' done' : '') + '" title="Objectif du jour">🎯 <b>' + Math.min(d.xp, P.goal) + '</b>/' + P.goal + '</span>';
  }

  /* ---------- onglet Mes stats ---------- */
  function kpi(cls, val, lbl) { return '<div class="hp-kpi ' + cls + '"><b>' + val + '</b><span>' + lbl + '</span></div>'; }
  function delta(a, b) {
    if (a == null || b == null) return '';
    var d = a - b; if (!d) return ' <small class="hp-delta">=</small>';
    return ' <small class="hp-delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + Math.abs(d) + '</small>';
  }
  function renderStats() {
    var root = document.getElementById('hp-progress');
    if (!root) return;
    prog();
    var now = new Date(), totals = HP.totalsFrom(storage, VOCAB), themes = HP.themeMastery(storage, VOCAB);
    var w0 = HP.rangeSum(P.days, HP.addDays(now, -6), 7), w1 = HP.rangeSum(P.days, HP.addDays(now, -13), 7);
    var r0 = HP.rate(w0), r1 = HP.rate(w1), active30 = 0;
    for (var i = 0; i < 30; i++) if (HP.dayActive(P.days[HP.dayKey(HP.addDays(now, -i))])) active30++;
    var nWords = themes.reduce(function (s, t) { return s + t.n; }, 0);
    var answers = totals.qOk + totals.qKo + totals.fK + totals.fA + totals.fS + totals.cK + totals.cA + totals.cS;
    var nb = Object.keys(P.badges).length;
    root.innerHTML =
      '<div class="stats-card">' + HP.levelCard(P, { goalPicker: true }) + '</div>' +
      '<div class="stats-card"><h3>Ces 7 derniers jours</h3><div class="hp-kpis">' +
        kpi('', HP.fmt(w0.xp) + delta(w0.xp, w1.xp), 'XP gagnés') +
        kpi('sky', HP.fmt(HP.dayGood(w0) + HP.dayBad(w0)), 'réponses') +
        kpi('green', (r0 == null ? '—' : r0 + '%') + delta(r0, r1), 'de réussite') +
        kpi('gold', active30 + '/30', 'jours actifs (30 j)') +
        kpi('green', HP.fmt(totals.mastered) + '<small class="hp-of">/' + HP.fmt(nWords) + '</small>', 'mots maîtrisés') +
        kpi('rose', HP.fmt(answers), 'réponses au total') +
      '</div><p class="hp-note">Flèches : comparaison avec les 7 jours précédents. Un mot compte comme maîtrisé s\'il l\'est au quiz <em>ou</em> en flashcards.</p></div>' +
      '<div class="stats-card"><h3>Régularité</h3>' + HP.heatmap(P.days, 17) + '</div>' +
      '<div class="stats-card"><h3>XP par jour — 30 derniers jours</h3>' + HP.xpBars(P.days, 30, P.goal) + '</div>' +
      '<div class="stats-card"><h3>Taux de réussite par semaine</h3>' + HP.rateLine(P.days, 8) +
        '<p class="hp-note">Toutes réponses confondues : quiz, flashcards et conjugaison.</p></div>' +
      '<div class="stats-card"><h3>Maîtrise par thème</h3>' + HP.themeBars(themes) + '</div>' +
      '<div class="stats-card"><h3>Badges <small class="hp-of">' + nb + ' / ' + HP.BADGES.length + '</small></h3>' + HP.badgesGrid(P.badges) + '</div>' +
      '<div class="stats-card hp-rules"><h3>Comment gagner des XP</h3><ul>' +
        '<li>Quiz : <b>+' + HP.XP.quizOk + '</b> bonne réponse, <b>+' + HP.XP.quizKo + '</b> erreur (l\'effort compte)</li>' +
        '<li>Flashcard : <b>+' + HP.XP.flashKnown + '</b> « je sais », <b>+' + HP.XP.flashAgain + '</b> « à revoir »</li>' +
        '<li>Conjugaison : <b>+' + HP.XP.conjKnown + '</b> réussie, <b>+' + HP.XP.conjAgain + '</b> à revoir</li>' +
        '<li>Nouveau mot maîtrisé : <b>+' + HP.XP.mastered + '</b> · Objectif du jour : <b>+' + HP.XP.goal + '</b> · 10 bonnes réponses d\'affilée : <b>+' + HP.XP.combo + '</b></li>' +
      '</ul></div>';
    root.querySelectorAll('[data-goal]').forEach(function (b) {
      b.addEventListener('click', function () { P.goal = +b.dataset.goal; saveData(); renderStats(); hud(); });
    });
  }

  var CSS = '' +
    '#hp-hud{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:-6px auto 18px}' +
    '.hp-hud-pill,.hp-hud-lv{display:inline-flex;align-items:center;gap:6px;background:var(--glass);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--ink-soft);backdrop-filter:blur(8px)}' +
    '.hp-hud-pill b{color:var(--accent);font-weight:800}.hp-hud-pill.done{background:var(--mint);border-color:transparent}.hp-hud-pill.done b{color:var(--olive)}' +
    '.hp-hud-lv{cursor:pointer;font:800 13px var(--font-ui);color:var(--ink)}.hp-hud-lv .hp-he{display:grid;place-items:center;width:22px;height:22px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--on-accent);font-size:13px}' +
    '.hp-hud-lv i{display:block;width:56px;height:6px;border-radius:9px;background:var(--accent-tint);overflow:hidden}.hp-hud-lv i b{display:block;height:100%;background:var(--accent);border-radius:9px}' +
    '#hp-toasts{position:fixed;right:16px;bottom:16px;z-index:9999;display:grid;gap:8px;justify-items:end;pointer-events:none}' +
    '.hp-toast{display:flex;gap:10px;align-items:center;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:10px 14px;box-shadow:var(--shadow-pop);font-size:13.5px;animation:hpIn .25s ease-out;transition:opacity .35s,transform .35s}' +
    '.hp-toast.xp{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--on-accent);font:900 15px var(--font-display);border:0;padding:7px 14px}' +
    '.hp-toast.goal{background:var(--mint);border-color:transparent}.hp-toast.badge{background:var(--peach);border-color:transparent}' +
    '.hp-toast.out{opacity:0;transform:translateY(8px)}@keyframes hpIn{from{opacity:0;transform:translateY(10px) scale(.96)}}' +
    '.hp-cele{position:fixed;inset:0;z-index:10000;background:var(--overlay);display:grid;place-items:center;padding:16px;overflow:hidden}' +
    '.hp-cele-card{position:relative;z-index:1;background:var(--paper);border-radius:28px;padding:30px 34px;text-align:center;max-width:360px;box-shadow:var(--shadow-pop);animation:hpPop .4s cubic-bezier(.2,1.4,.4,1)}' +
    '.hp-cele-big{width:96px;height:96px;margin:0 auto 14px;border-radius:30px;display:grid;place-items:center;font:700 52px var(--font-he);color:var(--on-accent);background:linear-gradient(135deg,var(--accent),var(--accent-2));transform:rotate(-6deg)}' +
    '.hp-cele-card h3{font:900 28px var(--font-display);margin-bottom:6px}.hp-cele-card p{color:var(--ink-soft);margin-bottom:18px}' +
    '@keyframes hpPop{from{transform:scale(.7);opacity:0}}' +
    '.hp-confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:3px;animation:hpFall 1.8s ease-in forwards}' +
    '@keyframes hpFall{to{transform:translateY(105vh) rotate(540deg);opacity:.6}}' +
    '#hp-progress{display:grid;gap:18px;margin-bottom:18px}#hp-progress .stats-card{margin:0}' +
    '.hp-note{font-size:12px;color:var(--muted);font-style:italic;margin-top:12px}.hp-of{font-size:.55em;color:var(--muted);font-weight:700}' +
    '.hp-delta{font:800 11px var(--font-ui);vertical-align:middle}.hp-delta.up{color:var(--olive)}.hp-delta.down{color:var(--rose)}' +
    '.hp-rules ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:14px;color:var(--ink-soft)}.hp-rules b{color:var(--accent)}' +
    '.hp-sep{font:800 13px var(--font-ui);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;text-align:center;margin:8px 0 14px}' +
    '@media (prefers-reduced-motion:reduce){.hp-toast,.hp-cele-card,.hp-confetti i{animation:none}}';

  function install() {
    HP.injectCss();
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    prog();
    lastLevel = HP.levelInfo(P.xp).level;
    checkBadges();

    /* bandeau sous les compteurs */
    var gs = document.getElementById('global-stats');
    if (gs) {
      var h = document.createElement('div'); h.id = 'hp-hud';
      gs.parentNode.insertBefore(h, gs.nextSibling);
      h.addEventListener('click', function (e) {
        if (e.target.closest('[data-go]')) { var t = document.querySelector('.tab[data-tab="stats"]'); if (t) t.click(); }
      });
    }
    /* onglet stats : la progression passe en tête */
    var panel = document.getElementById('panel-stats');
    if (panel) {
      var root = document.createElement('div'); root.id = 'hp-progress';
      panel.insertBefore(root, panel.firstChild);
      var sep = document.createElement('div'); sep.className = 'hp-sep'; sep.textContent = 'Détail par activité';
      panel.insertBefore(sep, root.nextSibling);
    }
    var t = document.querySelector('.tab[data-tab="stats"]');
    if (t) {
      t.textContent = 'Ma progression';
      t.addEventListener('click', renderStats);
    }

    /* crochet quiz : updateWordStat est une fonction globale, on l'enveloppe */
    var orig = window.updateWordStat;
    if (typeof orig === 'function') {
      updateWordStat = function (item, result) {
        var was = masteredNow(item.he + '|' + item.fr);
        orig(item, result);
        onQuiz(item, result, was);
        saveData();
      };
    }
    /* crochet sauvegarde : synchronise le résumé vers l'espace de la prof */
    var origSave = window.saveData;
    if (typeof origSave === 'function') {
      saveData = function () { origSave(); sync(); };
    }
    saveData();
    hud();
    renderStats();
  }

  return { install: install, before: before, onFlash: onFlash, renderStats: renderStats, hud: hud };
})();
