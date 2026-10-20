/* =====================================================================
   HP — noyau de progression partagé (espace élève, back-office, site perso)
   XP, niveaux, séries de jours, badges, résumé pour la prof, graphiques.
   Aucune dépendance. Les couleurs viennent des jetons de la charte.
   ===================================================================== */
var HP = (function () {
  'use strict';

  /* ---------- barème XP ---------- */
  var XP = {
    quizOk: 10, quizKo: 3,
    flashKnown: 8, flashAgain: 3, flashSoft: 2,
    conjKnown: 12, conjAgain: 4, conjSoft: 2,
    mastered: 15,      // chaque nouveau mot maîtrisé
    goal: 25,          // objectif du jour atteint
    combo: 20          // toutes les 10 bonnes réponses d'affilée
  };

  /* ---------- niveaux : une lettre de l'alphabet par niveau ---------- */
  var LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
  var TIERS = [
    { from: 1,  fr: 'Débutant',    he: 'מַתְחִיל' },
    { from: 4,  fr: 'Apprenti',    he: 'תַּלְמִיד' },
    { from: 7,  fr: 'Explorateur', he: 'חוֹקֵר' },
    { from: 10, fr: 'Confirmé',    he: 'מְנֻסֶּה' },
    { from: 13, fr: 'Avancé',      he: 'מִתְקַדֵּם' },
    { from: 16, fr: 'Expert',      he: 'מֻמְחֶה' },
    { from: 19, fr: 'Maître',      he: 'רַב' },
    { from: 22, fr: 'Sage',        he: 'חָכָם' }
  ];
  function stepFor(level) { return 150 + 100 * (level - 1); }
  function levelInfo(xp) {
    xp = Math.max(0, xp || 0);
    var level = 1, floor = 0;
    while (xp >= floor + stepFor(level)) { floor += stepFor(level); level++; }
    var step = stepFor(level), tier = TIERS[0];
    TIERS.forEach(function (t) { if (level >= t.from) tier = t; });
    return {
      level: level,
      letter: LETTERS.charAt(Math.min(level, LETTERS.length) - 1),
      title: tier.fr, titleHe: tier.he,
      into: xp - floor, step: step, toNext: floor + step - xp,
      pct: Math.round(100 * (xp - floor) / step)
    };
  }

  /* ---------- dates ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDay(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function shortDate(d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }

  function emptyDay() {
    return { xp: 0, qOk: 0, qKo: 0, fK: 0, fA: 0, fS: 0, cK: 0, cA: 0, cS: 0, goal: 0 };
  }
  function dayGood(d) { return (d.qOk || 0) + (d.fK || 0) + (d.cK || 0); }
  function dayBad(d) { return (d.qKo || 0) + (d.fA || 0) + (d.fS || 0) + (d.cA || 0) + (d.cS || 0); }
  function dayActive(d) { return d && dayGood(d) + dayBad(d) > 0; }

  function streaks(days) {
    var today = new Date(), cur = 0, best = 0, run = 0;
    var d = new Date(today);
    if (!dayActive(days[dayKey(d)])) d = addDays(d, -1);   // aujourd'hui pas encore joué : la série tient
    while (dayActive(days[dayKey(d)])) { cur++; d = addDays(d, -1); }
    var keys = Object.keys(days).filter(function (k) { return dayActive(days[k]); }).sort();
    var prev = null;
    keys.forEach(function (k) {
      var dt = parseDay(k);
      run = (prev && Math.round((dt - prev) / 864e5) === 1) ? run + 1 : 1;
      if (run > best) best = run;
      prev = dt;
    });
    return { cur: cur, best: Math.max(best, cur) };
  }

  /* ---------- maîtrise (quiz OU flashcards) ---------- */
  function quizMastered(s) {
    if (!s) return false;
    if (s.correct >= 3 && s.wrong === 0) return true;
    return s.seen >= 4 && s.correct / s.seen >= 0.8;
  }
  function flashMastered(s) {
    if (!s) return false;
    if (s.known >= 2 && !s.again && !s.soft) return true;
    return s.seen >= 4 && s.known / s.seen >= 0.8;
  }
  function wordMastered(storage, k) {
    return quizMastered(storage.wordStats && storage.wordStats[k]) ||
           flashMastered(storage.flash && storage.flash[k]);
  }

  function totalsFrom(storage, VOCAB) {
    var t = { qOk: 0, qKo: 0, fK: 0, fA: 0, fS: 0, cK: 0, cA: 0, cS: 0, mastered: 0 };
    var k, s;
    for (k in (storage.wordStats || {})) { s = storage.wordStats[k]; t.qOk += s.correct || 0; t.qKo += s.wrong || 0; }
    for (k in (storage.flash || {})) { s = storage.flash[k]; t.fK += s.known || 0; t.fA += s.again || 0; t.fS += s.soft || 0; }
    for (k in (storage.conj || {})) { s = storage.conj[k]; t.cK += s.known || 0; t.cA += s.again || 0; t.cS += s.soft || 0; }
    var seen = {};
    Object.keys(VOCAB || {}).forEach(function (th) {
      VOCAB[th].forEach(function (e) {
        var key = e[0] + '|' + e[1];
        if (seen[key]) return; seen[key] = 1;
        if (wordMastered(storage, key)) t.mastered++;
      });
    });
    return t;
  }

  function themeMastery(storage, VOCAB) {
    return Object.keys(VOCAB || {}).map(function (th) {
      var n = 0, m = 0, seen = 0, vu = {};
      VOCAB[th].forEach(function (e) {
        var key = e[0] + '|' + e[1];
        if (vu[key]) return; vu[key] = 1; n++;
        var q = storage.wordStats && storage.wordStats[key], f = storage.flash && storage.flash[key];
        if ((q && q.seen) || (f && f.seen)) seen++;
        if (wordMastered(storage, key)) m++;
      });
      var run = storage.themeRuns && storage.themeRuns[th];
      return { theme: th, n: n, m: m, seen: seen, pct: n ? Math.round(100 * m / n) : 0, runs: run ? +run.n || 0 : 0 };
    });
  }

  function weakWords(storage, max) {
    var map = {};
    function add(k, bad, seen) {
      var p = k.split('|');
      var o = map[k] || (map[k] = { he: p[0], fr: p[1] || '', bad: 0, seen: 0 });
      o.bad += bad; o.seen += seen;
    }
    var k, s;
    for (k in (storage.wordStats || {})) { s = storage.wordStats[k]; if (s.wrong) add(k, s.wrong, s.seen || 0); }
    for (k in (storage.flash || {})) { s = storage.flash[k]; if (s.again) add(k, s.again, s.seen || 0); }
    return Object.keys(map).map(function (x) { return map[x]; })
      .sort(function (a, b) { return b.bad - a.bad || (b.bad / (b.seen || 1)) - (a.bad / (a.seen || 1)); })
      .slice(0, max || 15);
  }

  /* ---------- badges ---------- */
  var BADGES = [
    { id: 'first',   icon: '🌱', name: 'Premier pas',         desc: 'Répondre à sa première carte',             test: function (c) { return c.answers >= 1; } },
    { id: 'streak3', icon: '🔥', name: 'Ça chauffe',          desc: '3 jours de révision d\'affilée',            test: function (c) { return c.best >= 3; } },
    { id: 'streak7', icon: '🔥', name: 'Une semaine pile',    desc: '7 jours d\'affilée',                        test: function (c) { return c.best >= 7; } },
    { id: 'streak30',icon: '🌋', name: 'Inarrêtable',         desc: '30 jours d\'affilée',                       test: function (c) { return c.best >= 30; } },
    { id: 'goal7',   icon: '🎯', name: 'Régulier',            desc: 'Objectif du jour atteint 7 fois',           test: function (c) { return c.goalDays >= 7; } },
    { id: 'day200',  icon: '💪', name: 'Grosse journée',      desc: '200 XP en une journée',                     test: function (c) { return c.maxDay >= 200; } },
    { id: 'xp1000',  icon: '⭐', name: '1 000 XP',            desc: 'Cumuler 1 000 XP',                          test: function (c) { return c.xp >= 1000; } },
    { id: 'xp5000',  icon: '🌟', name: '5 000 XP',            desc: 'Cumuler 5 000 XP',                          test: function (c) { return c.xp >= 5000; } },
    { id: 'cards100',icon: '🃏', name: 'Cent cartes',         desc: '100 flashcards retournées',                 test: function (c) { return c.cards >= 100; } },
    { id: 'cards1k', icon: '🗂️', name: 'Mille cartes',        desc: '1 000 flashcards retournées',               test: function (c) { return c.cards >= 1000; } },
    { id: 'mast50',  icon: '📗', name: '50 mots acquis',      desc: '50 mots maîtrisés',                         test: function (c) { return c.mastered >= 50; } },
    { id: 'mast200', icon: '📚', name: '200 mots acquis',     desc: '200 mots maîtrisés',                        test: function (c) { return c.mastered >= 200; } },
    { id: 'theme',   icon: '🏆', name: 'Thème bouclé',        desc: 'Maîtriser tous les mots d\'un thème',      test: function (c) { return c.themesDone >= 1; } },
    { id: 'conj50',  icon: '🧩', name: 'Conjugueur',          desc: '50 conjugaisons réussies',                  test: function (c) { return c.conj >= 50; } },
    { id: 'combo20', icon: '⚡', name: 'Sans faute',          desc: '20 bonnes réponses d\'affilée',             test: function (c) { return c.combo >= 20; } },
    { id: 'early',   icon: '🌅', name: 'Lève-tôt',            desc: 'Réviser avant 8 h',                         test: function (c) { return c.early; } },
    { id: 'night',   icon: '🌙', name: 'Oiseau de nuit',      desc: 'Réviser après 22 h',                        test: function (c) { return c.night; } }
  ];

  function badgeContext(P, totals, themes) {
    var st = streaks(P.days || {}), goalDays = 0, maxDay = 0;
    Object.keys(P.days || {}).forEach(function (k) {
      var d = P.days[k]; if (d.goal) goalDays++; if (d.xp > maxDay) maxDay = d.xp;
    });
    return {
      xp: P.xp || 0, best: st.best, cur: st.cur, goalDays: goalDays, maxDay: maxDay,
      answers: totals.qOk + totals.qKo + totals.fK + totals.fA + totals.fS + totals.cK + totals.cA + totals.cS,
      cards: totals.fK + totals.fA + totals.fS + totals.cK + totals.cA + totals.cS,
      mastered: totals.mastered, conj: totals.cK,
      themesDone: (themes || []).filter(function (t) { return t.n >= 5 && t.m === t.n; }).length,
      combo: P.bestCombo || 0, early: !!P.early, night: !!P.night
    };
  }

  /* ---------- résumé envoyé à la prof ---------- */
  function summarize(storage, P, VOCAB) {
    var totals = totalsFrom(storage, VOCAB), themes = themeMastery(storage, VOCAB);
    var st = streaks(P.days || {}), keep = {}, cut = dayKey(addDays(new Date(), -180));
    Object.keys(P.days || {}).forEach(function (k) { if (k >= cut) keep[k] = P.days[k]; });
    var last = Object.keys(keep).filter(function (k) { return dayActive(keep[k]); }).sort().pop() || null;
    return {
      updatedAt: new Date().toISOString(), xp: P.xp || 0, level: levelInfo(P.xp).level,
      streak: st.cur, best: st.best, lastActive: last, goal: P.goal || 60,
      days: keep, totals: totals, themes: themes, weak: weakWords(storage, 15),
      badges: P.badges || {}, bestCombo: P.bestCombo || 0
    };
  }

  /* ---------- agrégats ---------- */
  function rangeSum(days, from, n) {
    var s = emptyDay();
    for (var i = 0; i < n; i++) {
      var d = days[dayKey(addDays(from, i))];
      if (d) for (var k in s) s[k] += +d[k] || 0;
    }
    return s;
  }
  function rate(d) { var g = dayGood(d), b = dayBad(d); return g + b ? Math.round(100 * g / (g + b)) : null; }
  function weekly(days, weeks) {
    var out = [], today = new Date();
    var monday = addDays(today, -((today.getDay() + 6) % 7));
    for (var w = weeks - 1; w >= 0; w--) {
      var start = addDays(monday, -7 * w), s = rangeSum(days, start, 7);
      out.push({ start: start, sum: s, rate: rate(s), xp: s.xp, answers: dayGood(s) + dayBad(s) });
    }
    return out;
  }

  /* ---------- rendu ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { n = +n; return (isFinite(n) ? n : 0).toLocaleString('fr-FR'); }

  function levelCard(P, opts) {
    opts = opts || {};
    var L = levelInfo(P.xp), st = streaks(P.days || {}), today = (P.days || {})[dayKey()] || emptyDay();
    var goal = P.goal || 60, gp = Math.min(100, Math.round(100 * today.xp / goal));
    var R = 34, C = 2 * Math.PI * R;
    return '<div class="hp-level">' +
      '<div class="hp-medal" aria-hidden="true"><span>' + L.letter + '</span></div>' +
      '<div class="hp-level-main">' +
        '<div class="hp-level-top"><strong>Niveau ' + L.level + '</strong>' +
        '<span class="hp-tier">' + L.title + ' · <span class="hp-he">' + L.titleHe + '</span></span></div>' +
        '<div class="hp-xpbar"><i style="width:' + L.pct + '%"></i></div>' +
        '<div class="hp-level-sub">' + fmt(P.xp) + ' XP au total · encore <b>' + fmt(L.toNext) + ' XP</b> pour le niveau ' + (L.level + 1) + '</div>' +
      '</div>' +
      '<div class="hp-mini">' +
        '<div class="hp-ring" title="Objectif du jour">' +
          '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="' + R + '" class="hp-ring-bg"/>' +
          (gp ? '<circle cx="40" cy="40" r="' + R + '" class="hp-ring-fg" stroke-dasharray="' + (C * gp / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/>' : '') + '</svg>' +
          '<div class="hp-ring-txt"><b>' + today.xp + '</b><span>/ ' + goal + ' XP</span></div>' +
        '</div>' +
        '<div class="hp-streak"><span class="hp-flame">' + (st.cur ? '🔥' : '·') + '</span><b>' + st.cur + '</b><span>jour' + (st.cur > 1 ? 's' : '') + ' d\'affilée</span><em>record ' + st.best + '</em></div>' +
      '</div>' +
      (opts.goalPicker ? '<div class="hp-goalpick">Objectif du jour : ' + [30, 60, 100, 150].map(function (g) {
        return '<button type="button" data-goal="' + g + '" class="' + (g === goal ? 'on' : '') + '">' + g + ' XP</button>';
      }).join('') + '</div>' : '') +
    '</div>';
  }

  function heatmap(days, weeks) {
    weeks = weeks || 17;
    var today = new Date();
    var end = addDays(today, 6 - ((today.getDay() + 6) % 7));        // dimanche de cette semaine
    var start = addDays(end, -(weeks * 7) + 1);
    var max = 1;
    Object.keys(days || {}).forEach(function (k) { if (days[k].xp > max) max = days[k].xp; });
    var cols = '', months = '', lastM = -1, lastCol = -9;
    for (var w = 0; w < weeks; w++) {
      var cells = '';
      var wkStart = addDays(start, w * 7);
      if (wkStart.getMonth() !== lastM && w - lastCol >= 3) {
        months += '<span style="grid-column:' + (w + 1) + '">' + wkStart.toLocaleDateString('fr-FR', { month: 'short' }) + '</span>';
        lastM = wkStart.getMonth(); lastCol = w;
      }
      for (var i = 0; i < 7; i++) {
        var d = addDays(start, w * 7 + i), k = dayKey(d), v = days && days[k] ? days[k].xp : 0;
        var lvl = d > today ? 'f' : (v ? Math.min(4, 1 + Math.floor(3.999 * v / max)) : 0);
        cells += '<i class="h' + lvl + '" title="' + shortDate(d) + ' : ' + v + ' XP"></i>';
      }
      cols += '<div class="hp-hcol">' + cells + '</div>';
    }
    return '<div class="hp-heat"><div class="hp-heat-days"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span></div>' +
      '<div class="hp-heat-body"><div class="hp-heat-months" style="grid-template-columns:repeat(' + weeks + ',17px)">' + months + '</div>' +
      '<div class="hp-heat-grid">' + cols + '</div></div></div>' +
      '<div class="hp-legend">Moins <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> Plus</div>';
  }

  function xpBars(days, n, goal) {
    n = n || 30;
    var W = 620, H = 170, padB = 22, padT = 10, today = new Date(), vals = [], max = goal || 10;
    for (var i = n - 1; i >= 0; i--) {
      var d = addDays(today, -i), v = days && days[dayKey(d)] ? days[dayKey(d)].xp : 0;
      vals.push({ d: d, v: v }); if (v > max) max = v;
    }
    var bw = W / n, svg = '';
    vals.forEach(function (o, i) {
      var h = Math.round((H - padB - padT) * o.v / max), x = i * bw + bw * 0.18, y = H - padB - h;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(h, o.v ? 2 : 0) +
        '" rx="3" class="' + (goal && o.v >= goal ? 'hp-bar-hit' : 'hp-bar') + '"><title>' + shortDate(o.d) + ' : ' + o.v + ' XP</title></rect>';
      if (i % 7 === (n - 1) % 7) svg += '<text x="' + (i * bw + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" class="hp-axis" text-anchor="middle">' + shortDate(o.d) + '</text>';
    });
    if (goal) {
      var gy = H - padB - Math.round((H - padB - padT) * goal / max);
      svg += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" class="hp-goal-line"/>' +
             '<text x="' + (W - 4) + '" y="' + (gy - 5) + '" class="hp-axis hp-goal-txt" text-anchor="end">objectif ' + goal + ' XP</text>';
    }
    return '<div class="hp-chart-wrap"><svg class="hp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="XP par jour">' + svg + '</svg></div>';
  }

  function rateLine(days, weeks) {
    var data = weekly(days || {}, weeks || 8), W = 620, H = 170, padB = 22, padT = 14, padX = 24;
    var pts = [], svg = '';
    [50, 75, 100].forEach(function (g) {
      var y = H - padB - (H - padB - padT) * g / 100;
      svg += '<line x1="' + padX + '" x2="' + (W - padX) + '" y1="' + y + '" y2="' + y + '" class="hp-grid"/>' +
             '<text x="2" y="' + (y + 4) + '" class="hp-axis">' + g + '%</text>';
    });
    var step = (W - 2 * padX) / Math.max(1, data.length - 1);
    data.forEach(function (w, i) {
      var x = padX + i * step;
      svg += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" class="hp-axis" text-anchor="middle">' + shortDate(w.start) + '</text>';
      if (w.rate == null) return;
      var y = H - padB - (H - padB - padT) * w.rate / 100;
      pts.push([x, y, w]);
    });
    if (pts.length > 1) svg += '<polyline class="hp-line" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (p) {
      svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" class="hp-dot"><title>Semaine du ' +
        shortDate(p[2].start) + ' : ' + p[2].rate + ' % de réussite sur ' + p[2].answers + ' réponses</title></circle>' +
        '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 9).toFixed(1) + '" class="hp-val" text-anchor="middle">' + p[2].rate + '%</text>';
    });
    if (!pts.length) svg += '<text x="' + W / 2 + '" y="' + H / 2 + '" class="hp-axis" text-anchor="middle">Pas encore de réponses enregistrées</text>';
    return '<div class="hp-chart-wrap"><svg class="hp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Taux de réussite par semaine">' + svg + '</svg></div>';
  }

  function themeBars(themes, opts) {
    opts = opts || {};
    var list = (themes || []).slice().sort(function (a, b) { return b.pct - a.pct || b.seen - a.seen || a.theme.localeCompare(b.theme, 'fr'); });
    if (opts.limit) list = list.slice(0, opts.limit);
    if (!list.length) return '<p class="hp-empty">Aucun thème pour le moment.</p>';
    return '<div class="hp-themes">' + list.map(function (t) {
      var seenPct = t.n ? Math.round(100 * t.seen / t.n) : 0;
      return '<div class="hp-theme"><div class="hp-theme-name">' + esc(t.theme) +
        (t.runs ? ' <span class="hp-runs" title="Série de flashcards du thème terminée ' + t.runs + ' fois">✓ ' + t.runs + '×</span>' : '') + '</div>' +
        '<div class="hp-theme-bar" title="' + t.m + ' maîtrisés, ' + t.seen + ' vus sur ' + t.n + '"><i class="seen" style="width:' + seenPct + '%"></i><i class="m" style="width:' + t.pct + '%"></i></div>' +
        '<div class="hp-theme-num">' + t.m + '/' + t.n + '</div></div>';
    }).join('') + '</div><div class="hp-legend2"><i class="m"></i> maîtrisés <i class="seen"></i> déjà vus</div>';
  }

  function badgesGrid(earned) {
    earned = earned || {};
    return '<div class="hp-badges">' + BADGES.map(function (b) {
      var on = earned[b.id];
      return '<div class="hp-badge' + (on ? ' on' : '') + '" title="' + esc(b.desc) + (on ? ' — obtenu le ' + shortDate(parseDay(on)) : '') + '">' +
        '<span class="hp-badge-ic">' + b.icon + '</span><b>' + esc(b.name) + '</b><small>' + (on ? 'Obtenu le ' + shortDate(parseDay(on)) : esc(b.desc)) + '</small></div>';
    }).join('') + '</div>';
  }

  function sparkline(days, n) {
    n = n || 14;
    var vals = [], max = 1, today = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = days && days[dayKey(addDays(today, -i))]; var v = d ? d.xp : 0; vals.push(v); if (v > max) max = v;
    }
    var W = 120, H = 30, bw = W / n;
    return '<svg class="hp-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + vals.map(function (v, i) {
      var h = Math.round((H - 2) * v / max);
      return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (H - Math.max(h, 1)) + '" width="' + (bw - 2).toFixed(1) + '" height="' + Math.max(h, 1) + '" rx="1.5" class="' + (v ? 'hp-bar' : 'hp-bar0') + '"/>';
    }).join('') + '</svg>';
  }

  var CSS = '' +
    '.hp-level{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center}' +
    '.hp-medal{width:74px;height:74px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 14px 28px -14px var(--accent);transform:rotate(-6deg)}' +
    '.hp-medal span{font:700 38px/1 var(--font-he);color:var(--on-accent);transform:rotate(6deg)}' +
    '.hp-level-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:8px}' +
    '.hp-level-top strong{font:900 22px/1.1 var(--font-display);color:var(--ink)}' +
    '.hp-tier{font-weight:700;color:var(--accent);font-size:14px}.hp-he{font-family:var(--font-he)}' +
    '.hp-xpbar{height:12px;border-radius:99px;background:var(--accent-tint);overflow:hidden}' +
    '.hp-xpbar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .6s}' +
    '.hp-level-sub{margin-top:7px;font-size:13px;color:var(--muted)}.hp-level-sub b{color:var(--ink-soft)}' +
    '.hp-mini{display:flex;gap:14px;align-items:center}' +
    '.hp-ring{position:relative;width:80px;height:80px}.hp-ring svg{width:80px;height:80px;transform:rotate(-90deg)}' +
    '.hp-ring-bg{fill:none;stroke:var(--mint);stroke-width:8}.hp-ring-fg{fill:none;stroke:var(--olive);stroke-width:8;stroke-linecap:round;transition:stroke-dasharray .6s}' +
    '.hp-ring-txt{position:absolute;inset:0;display:grid;place-content:center;text-align:center;line-height:1.05}' +
    '.hp-ring-txt b{font:900 19px var(--font-display);color:var(--olive)}.hp-ring-txt span{font-size:10.5px;color:var(--muted);font-weight:700}' +
    '.hp-streak{display:grid;justify-items:center;background:var(--peach);border-radius:18px;padding:8px 12px;min-width:84px;line-height:1.1}' +
    '.hp-streak .hp-flame{font-size:20px}.hp-streak b{font:900 22px var(--font-display);color:var(--gold)}' +
    '.hp-streak span{font-size:11px;font-weight:700;color:var(--ink-soft)}.hp-streak em{font-style:normal;font-size:10.5px;color:var(--muted);margin-top:2px}' +
    '.hp-goalpick{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--muted);font-weight:600}' +
    '.hp-goalpick button{border:1.5px solid var(--line);background:var(--paper);color:var(--ink-soft);border-radius:99px;padding:5px 12px;font:700 12.5px var(--font-ui);cursor:pointer}' +
    '.hp-goalpick button.on{background:var(--mint);color:var(--olive);border-color:transparent}' +
    '@media (max-width:640px){.hp-level{grid-template-columns:auto 1fr}.hp-mini{grid-column:1/-1;justify-content:center}}' +
    '.hp-heat{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}' +
    '.hp-heat-days{display:grid;grid-template-rows:16px repeat(7,14px);row-gap:3px;font-size:10px;line-height:14px;color:var(--muted);font-weight:700;flex:none}' +
    '.hp-heat-body{flex:none}' +
    '.hp-heat-months{display:grid;height:16px;font-size:10px;color:var(--muted);font-weight:700;text-transform:capitalize;white-space:nowrap}' +
    '.hp-heat-grid{display:flex;gap:3px}.hp-hcol{display:grid;grid-template-rows:repeat(7,14px);gap:3px}' +
    '.hp-hcol i{display:block;width:14px;height:14px;border-radius:4px}.hp-legend i{display:block;width:11px;height:11px;border-radius:3px}' +
    '.h0{background:var(--line)}.hf{background:transparent}' +
    '.h1{background:color-mix(in srgb,var(--accent) 28%,var(--paper))}.h2{background:color-mix(in srgb,var(--accent) 52%,var(--paper))}' +
    '.h3{background:color-mix(in srgb,var(--accent) 76%,var(--paper))}.h4{background:var(--accent)}' +
    '.hp-legend{display:flex;align-items:center;justify-content:flex-start;gap:4px;font-size:11px;color:var(--muted);margin-top:8px}' +
    '.hp-chart-wrap{overflow-x:auto;overflow-y:hidden}' +
    '.hp-chart{width:100%;height:auto;max-height:230px;display:block;overflow:visible}' +
    '@media (max-width:640px){.hp-chart{min-width:520px}}' +
    '.hp-goal-txt{paint-order:stroke;stroke:var(--paper);stroke-width:4px;stroke-linejoin:round;font-weight:800;fill:var(--olive)}' +
    '.hp-bar{fill:color-mix(in srgb,var(--accent) 55%,var(--paper))}.hp-bar-hit{fill:var(--accent)}.hp-bar0{fill:var(--line)}' +
    '.hp-axis{fill:var(--muted);font:600 10.5px var(--font-ui)}.hp-val{fill:var(--ink-soft);font:800 11px var(--font-ui)}' +
    '.hp-goal-line{stroke:var(--olive);stroke-width:1.5;stroke-dasharray:5 5}.hp-grid{stroke:var(--line);stroke-width:1}' +
    '.hp-line{fill:none;stroke:var(--accent);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.hp-dot{fill:var(--paper);stroke:var(--accent);stroke-width:3}' +
    '.hp-spark{width:120px;height:30px;display:block}' +
    '.hp-themes{display:grid;gap:9px}.hp-theme{display:grid;grid-template-columns:minmax(110px,190px) 1fr 54px;gap:10px;align-items:center;font-size:13.5px}' +
    '.hp-theme-name{font-weight:600;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.hp-runs{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:var(--mint);color:var(--olive);font-size:11px;font-weight:800;vertical-align:1px}' +
    '.hp-theme-bar{position:relative;height:10px;border-radius:99px;background:var(--line);overflow:hidden}' +
    '.hp-theme-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px}.hp-theme-bar .seen{background:color-mix(in srgb,var(--accent) 25%,var(--paper))}' +
    '.hp-theme-bar .m{background:var(--olive)}.hp-theme-num{text-align:right;font-weight:800;color:var(--ink-soft);font-variant-numeric:tabular-nums}' +
    '.hp-legend2{display:flex;gap:6px 12px;align-items:center;font-size:11.5px;color:var(--muted);margin-top:10px}' +
    '.hp-legend2 i{display:inline-block;width:12px;height:8px;border-radius:9px}.hp-legend2 .m{background:var(--olive)}.hp-legend2 .seen{background:color-mix(in srgb,var(--accent) 25%,var(--paper))}' +
    '.hp-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}' +
    '.hp-badge{display:grid;justify-items:center;text-align:center;gap:3px;padding:14px 8px;border-radius:18px;background:var(--zebra);border:1px dashed var(--line-strong);opacity:.62}' +
    '.hp-badge .hp-badge-ic{font-size:28px;filter:grayscale(1)}.hp-badge b{font:800 13px var(--font-display);color:var(--ink-soft)}.hp-badge small{font-size:11px;color:var(--muted);line-height:1.3}' +
    '.hp-badge.on{opacity:1;background:var(--accent-tint);border:1px solid var(--accent-soft)}.hp-badge.on .hp-badge-ic{filter:none}.hp-badge.on b{color:var(--accent)}' +
    '.hp-empty{color:var(--muted);font-style:italic;font-size:14px}' +
    '.hp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px}' +
    '.hp-kpi{border-radius:18px;padding:14px 12px;background:var(--accent-tint)}.hp-kpi b{display:block;font:900 24px/1.1 var(--font-display);color:var(--accent);font-variant-numeric:tabular-nums}' +
    '.hp-kpi span{font-size:12px;font-weight:700;color:var(--ink-soft)}.hp-kpi.green{background:var(--mint)}.hp-kpi.green b{color:var(--olive)}' +
    '.hp-kpi.gold{background:var(--peach)}.hp-kpi.gold b{color:var(--gold)}.hp-kpi.rose{background:var(--rose-tint)}.hp-kpi.rose b{color:var(--rose)}' +
    '.hp-kpi.sky{background:var(--sky-tint)}.hp-kpi.sky b{color:var(--sky)}' +
    '.hp-weak{list-style:none;padding:0;margin:0;display:grid;gap:2px}.hp-weak li{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;padding:8px 4px;border-bottom:1px solid var(--line);font-size:14px}' +
    '.hp-weak .he{font-family:var(--font-he);font-weight:600;color:var(--he);direction:rtl;text-align:left}.hp-weak small{color:var(--muted);font-weight:600;white-space:nowrap}';

  function injectCss() {
    if (document.getElementById('hp-css')) return;
    var s = document.createElement('style'); s.id = 'hp-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  return {
    XP: XP, BADGES: BADGES, levelInfo: levelInfo, dayKey: dayKey, parseDay: parseDay, addDays: addDays,
    shortDate: shortDate, emptyDay: emptyDay, dayActive: dayActive, dayGood: dayGood, dayBad: dayBad,
    streaks: streaks, totalsFrom: totalsFrom, themeMastery: themeMastery, weakWords: weakWords,
    badgeContext: badgeContext, summarize: summarize, weekly: weekly, rangeSum: rangeSum, rate: rate,
    esc: esc, fmt: fmt, levelCard: levelCard, heatmap: heatmap, xpBars: xpBars, rateLine: rateLine,
    themeBars: themeBars, badgesGrid: badgesGrid, sparkline: sparkline, injectCss: injectCss
  };
})();
