/* =====================================================================
   HPAgendaUI — réservation des cours.
   · Mayane : calendrier de la semaine (tous les élèves), disponibilités,
     fermetures, ajout / annulation de cours, lien vers son agenda.
   · Élève : ses cours à venir et les créneaux libres ; il réserve en ligne.
   Les règles de calcul (créneaux, délais, fuseaux) sont dans HPCal (api/_agenda.js),
   partagé avec le serveur qui revérifie chaque réservation.
   ===================================================================== */
var HPAgendaUI = function (X) {
  'use strict';
  var $ = X.$, $$ = X.$$, esc = X.esc, cache = X.cache;
  var C = HPCal, MIN = 60000, HOUR = 36e5, DAY = 864e5;
  var LOCAL_TZ = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'; } catch (e) { return 'Europe/Paris'; } })();
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var ORDER = [1, 2, 3, 4, 5, 6, 0];
  var TZS = [['Asia/Jerusalem', 'Israël (Jérusalem)'], ['Europe/Paris', 'France (Paris)'], ['Europe/Brussels', 'Belgique (Bruxelles)'], ['Europe/Zurich', 'Suisse (Zurich)'],
    ['Europe/London', 'Royaume-Uni (Londres)'], ['America/Toronto', 'Canada (Montréal, Toronto)'], ['America/New_York', 'États-Unis (New York)'], ['America/Los_Angeles', 'États-Unis (Los Angeles)']];
  var TONES = [['var(--accent-tint)', 'var(--accent)'], ['var(--sky-tint)', 'var(--sky)'], ['var(--mint)', 'var(--olive)'], ['var(--peach)', 'var(--gold)'], ['var(--rose-tint)', 'var(--rose)']];
  var PX = 46;                       // hauteur d'une heure dans le calendrier

  /* ---------- formats de date ---------- */
  var F = {};
  function fm(tz, o) { var k = (tz || '') + JSON.stringify(o); return F[k] || (F[k] = new Intl.DateTimeFormat('fr-FR', Object.assign(tz ? { timeZone: tz } : {}, o))); }
  function fTime(ms, tz) { return fm(tz, { hour: '2-digit', minute: '2-digit' }).format(ms); }
  function fDay(ms, tz) { return fm(tz, { weekday: 'long', day: 'numeric', month: 'long' }).format(ms); }
  function fShort(ms, tz) { return fm(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(ms); }
  function fFull(ms, tz) { return fDay(ms, tz) + ' à ' + fTime(ms, tz); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function range(b, tz) { return fTime(b.start, tz) + ' – ' + fTime(b.end, tz); }
  function dur(b) { return C.durLabel(Math.round((b.end - b.start) / MIN)); }
  function err(code, e) {
    var M = {
      taken: 'Ce créneau vient d\'être pris. Choisis-en un autre.', unavailable: 'Ce créneau n\'est plus disponible.',
      too_soon: 'Ce créneau est trop proche : il faut réserver un peu plus à l\'avance.', too_far: 'Ce créneau est trop loin dans le temps.',
      closed: 'La réservation en ligne est fermée pour le moment.', duration: 'Cette durée n\'est plus proposée.',
      max_upcoming: 'Tu as déjà le nombre maximum de cours à venir.', too_late: 'Il est trop tard pour annuler en ligne : préviens Mayane directement.',
      not_found: 'Ce cours n\'existe plus.', not_student: 'Ta session a expiré : reconnecte-toi.', server_error: 'Le serveur n\'a pas répondu. Réessaie dans un instant.',
      not_configured: 'L\'agenda n\'est pas encore installé sur le serveur.'
    };
    return M[code] || X.errText(e || { message: code });
  }
  function cfgT() {                  // réglages de Mayane (avec son fuseau par défaut)
    var raw = (cache.settings && cache.settings.agenda) || null;
    return C.norm(raw || { tz: LOCAL_TZ });
  }
  function student(id) { return cache.students.filter(function (s) { return s.id === id; })[0] || null; }
  function sName(id) { var s = student(id); return s ? X.fullName(s) : 'Élève supprimé'; }
  function tone(id) { var i = cache.students.findIndex(function (s) { return s.id === id; }); return TONES[(i < 0 ? 0 : i) % TONES.length]; }
  function seenAt() { try { return +localStorage.getItem('hp_agenda_seen') || 0; } catch (e) { return 0; } }
  function setSeen() { try { localStorage.setItem('hp_agenda_seen', String(Date.now())); } catch (e) {} }
  function rid() { var a = new Uint8Array(20); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }

  /* ================================================================
     CÔTÉ MAYANE
     ================================================================ */
  var week = null;                   // lundi affiché (AAAA-MM-JJ, fuseau de Mayane)
  var draft = null;                  // disponibilités en cours de modification

  /* cours chargés : de -4 mois à +6 mois ; au-delà, chargés à la demande */
  function load() {
    if (!HPB.listBookings) { cache.bookings = []; return Promise.resolve(); }
    var now = Date.now(), from = now - 120 * DAY, to = now + 190 * DAY;
    return HPB.listBookings(from, to).then(function (l) { cache.bookings = l; cache.bkFrom = from; cache.bkTo = to; }, function (e) {
      cache.bookings = []; cache.bkFrom = cache.bkTo = 0; cache.bkError = e;   // table absente : l'agenda l'indique, le reste du site fonctionne
    });
  }
  function ensure(from, to) {
    if (cache.bkFrom && from >= cache.bkFrom && to <= cache.bkTo) return Promise.resolve(false);
    var a = Math.min(from, cache.bkFrom || from), b = Math.max(to, cache.bkTo || to);
    return HPB.listBookings(a, b).then(function (l) { cache.bookings = l; cache.bkFrom = a; cache.bkTo = b; return true; });
  }
  function booked() { return (cache.bookings || []).filter(function (b) { return b.status === 'booked'; }); }
  function upcoming(sid) { var now = Date.now(); return booked().filter(function (b) { return b.end > now && (!sid || b.studentId === sid); }); }
  function news() {
    var t = seenAt(), now = Date.now();
    return (cache.bookings || []).filter(function (b) {
      return b.end > now && ((b.by === 'student' && Date.parse(b.createdAt) > t) || (b.cancelledBy === 'student' && b.cancelledAt && Date.parse(b.cancelledAt) > t));
    }).sort(function (a, b) { return Date.parse(b.cancelledAt || b.createdAt) - Date.parse(a.cancelledAt || a.createdAt); });
  }
  function badge() { return news().length; }

  /* ---------- page Agenda ---------- */
  function page(sub) {
    if (sub === 'disponibilites') return availPage();
    var c = cfgT(), now = Date.now(), today = C.dayKey(now, c.tz);
    if (!week) week = monday(today);
    var days = []; for (var i = 0; i < 7; i++) days.push(C.addDaysKey(week, i));
    var from = C.dayStart(days[0], c.tz), to = C.dayStart(C.addDaysKey(week, 7), c.tz);
    var list = booked().filter(function (b) { return b.end > from && b.start < to; });
    var nw = news(), setup = !c.rules.length;
    var head = '<div class="bo-head"><div><h1 class="page-title">Agenda</h1><p>' +
      (c.open ? '<span class="pill green">Réservation en ligne ouverte</span>' : '<span class="pill grey">Réservation en ligne fermée</span>') +
      (c.tz !== LOCAL_TZ ? ' <span class="small muted">Horaires à l\'heure de ' + esc(C.tzCity(c.tz)) + '</span>' : '') + '</p></div>' +
      '<div class="row"><a class="btn" href="#/agenda/disponibilites">⚙️ Disponibilités</a><button class="btn primary" data-ag="add">+ Ajouter un cours</button></div></div>';
    var warn = cache.bkError ? '<div class="card" style="background:var(--rose-tint);border-color:transparent"><b>L\'agenda n\'est pas encore activé sur le serveur.</b> <span class="small">Benjamin doit lancer la mise à jour de la base de données (fichier supabase/migration-2026-10-20-agenda.sql).</span></div>' : '';
    var intro = setup ? '<div class="card ag-intro"><div class="big">🗓️</div><div><h3>Ouvrez vos créneaux</h3><p class="muted small">Indiquez vos heures de cours habituelles et les durées proposées (1 h, 1 h 30, 2 h…). Vos élèves pourront alors réserver eux-mêmes un créneau libre depuis leur espace.</p>' +
      '<a class="btn primary" href="#/agenda/disponibilites">Définir mes disponibilités</a></div></div>' : '';
    var box = nw.length ? '<div class="card ag-news"><h3>Nouveau depuis votre dernière visite <small>' + nw.length + '</small></h3><ul>' + nw.slice(0, 8).map(function (b) {
      var cancelled = b.status === 'cancelled';
      return '<li><span class="pill ' + (cancelled ? 'rose' : 'green') + '">' + (cancelled ? 'Annulé' : 'Réservé') + '</span> <b>' + esc(sName(b.studentId)) + '</b> · ' +
        esc(cap(fShort(b.start, c.tz))) + ' · ' + range(b, c.tz) + ' (' + dur(b) + ')</li>';
    }).join('') + '</ul></div>' : '';
    var label = fm(c.tz, { day: 'numeric', month: 'long' }).format(from) + ' – ' + fm(c.tz, { day: 'numeric', month: 'long', year: 'numeric' }).format(to - 1);
    var nav = '<div class="ag-weeknav"><button class="btn small" data-ag="prev" aria-label="Semaine précédente">‹</button>' +
      '<button class="btn small" data-ag="today">Cette semaine</button><button class="btn small" data-ag="next" aria-label="Semaine suivante">›</button>' +
      '<b>' + esc(label) + '</b><span class="ag-wsum">' + X.plural(list.length, 'cours', 'cours') + ' · ' + hoursOf(list) + '</span></div>';
    return head + '<div class="stack">' + warn + intro + box + '<div class="card ag-cal-card">' + nav + grid(c, days, list, today, now) + dayList(c, days, list, today) + '</div></div>';
  }
  function hoursOf(list) { var m = list.reduce(function (a, b) { return a + (b.end - b.start) / MIN; }, 0); return C.durLabel(Math.round(m)).replace(/^0 min$/, '0 h'); }
  function monday(key) { return C.addDaysKey(key, -((C.weekdayOfKey(key) + 6) % 7)); }
  function minsOf(ms, tz) { var p = C.parts(ms, tz); return p.h * 60 + p.mi; }

  /* calendrier en colonnes (ordinateur) */
  function grid(c, days, list, today, now) {
    var lo = 8 * 60, hi = 20 * 60;
    days.forEach(function (k) { C.windows(c, k).forEach(function (w) { lo = Math.min(lo, minsOf(w.s, c.tz)); hi = Math.max(hi, minsOf(w.e, c.tz) || 1440); }); });
    list.forEach(function (b) { lo = Math.min(lo, minsOf(b.start, c.tz)); var e = minsOf(b.end, c.tz); hi = Math.max(hi, e < minsOf(b.start, c.tz) ? 1440 : e); });
    lo = Math.floor(lo / 60) * 60; hi = Math.min(1440, Math.ceil(hi / 60) * 60);
    var H = (hi - lo) / 60 * PX;
    var y = function (m) { return Math.max(0, Math.min(H, (m - lo) / 60 * PX)); };
    var hours = ''; for (var h = lo; h < hi; h += 60) hours += '<div class="ag-h" style="top:' + y(h) + 'px">' + C.hmStr(h) + '</div>';
    var cols = days.map(function (k) {
      var d0 = C.dayStart(k, c.tz), d1 = C.dayStart(C.addDaysKey(k, 1), c.tz), wd = C.weekdayOfKey(k);
      var av = C.windows(c, k).map(function (w) { return '<div class="ag-av" style="top:' + y(minsOf(w.s, c.tz)) + 'px;height:' + (y(minsOf(w.e, c.tz) || 1440) - y(minsOf(w.s, c.tz))) + 'px"></div>'; }).join('');
      var bl = c.blocks.filter(function (b) { return Date.parse(b.e) > d0 && Date.parse(b.s) < d1; }).map(function (b) {
        var s = Math.max(Date.parse(b.s), d0), e = Math.min(Date.parse(b.e), d1);
        var top = s <= d0 ? 0 : y(minsOf(s, c.tz)), bot = e >= d1 ? H : y(minsOf(e, c.tz));
        return '<button type="button" class="ag-blk" data-blk="' + esc(b.s) + '" style="top:' + top + 'px;height:' + Math.max(14, bot - top) + 'px" title="' + esc(b.note || 'Fermé') + '"><span>' + esc(b.note || 'Fermé') + '</span></button>';
      }).join('');
      var bk = list.filter(function (b) { return b.start < d1 && b.end > d0; }).map(function (b) {
        var top = b.start <= d0 ? 0 : y(minsOf(b.start, c.tz)), bot = b.end >= d1 ? H : y(minsOf(b.end, c.tz)), t = tone(b.studentId);
        return '<button type="button" class="ag-bk" data-bk="' + b.id + '" style="top:' + top + 'px;height:' + Math.max(22, bot - top - 2) + 'px;background:' + t[0] + ';border-color:' + t[1] + '">' +
          '<b>' + esc(sName(b.studentId)) + '</b><span>' + range(b, c.tz) + '</span>' + (b.note ? '<i>' + esc(b.note) + '</i>' : '') + '</button>';
      }).join('');
      var nm = minsOf(now, c.tz), nowLine = k === today && nm >= lo && nm <= hi ? '<div class="ag-now" style="top:' + y(minsOf(now, c.tz)) + 'px"></div>' : '';
      return '<div class="ag-col' + (k === today ? ' today' : '') + (k < today ? ' past' : '') + '"><div class="ag-dh"><span>' + DAYS[wd].slice(0, 3) + '.</span><b>' + +k.slice(8) + '</b></div>' +
        '<div class="ag-body" data-day="' + k + '" data-lo="' + lo + '" style="height:' + H + 'px">' + av + bl + bk + nowLine + '</div></div>';
    }).join('');
    return '<div class="ag-grid"><div class="ag-hours"><div class="ag-dh"></div><div class="ag-body" style="height:' + H + 'px">' + hours + '</div></div>' + cols + '</div>' +
      '<p class="small muted ag-legend"><span class="ag-sw av"></span>Vos disponibilités <span class="ag-sw blk"></span>Fermé</p><p class="small muted ag-legend">Cliquez sur une case vide pour ajouter un cours.</p>';
  }
  /* liste par jour (téléphone) */
  function dayList(c, days, list, today) {
    return '<div class="ag-list">' + days.map(function (k) {
      var d0 = C.dayStart(k, c.tz), d1 = C.dayStart(C.addDaysKey(k, 1), c.tz);
      var l = list.filter(function (b) { return b.start < d1 && b.end > d0; });
      var w = C.windows(c, k), bl = c.blocks.filter(function (b) { return Date.parse(b.e) > d0 && Date.parse(b.s) < d1; });
      return '<div class="ag-ld' + (k === today ? ' today' : '') + '"><div class="ag-ldh"><b>' + esc(cap(fDay(d0 + 12 * HOUR, c.tz))) + '</b>' +
        (bl.length ? '<span class="pill rose">' + esc(bl[0].note || 'Fermé') + '</span>' : w.length ? '<span class="small muted">Disponible ' + w.map(function (x) { return fTime(x.s, c.tz) + '–' + fTime(x.e, c.tz); }).join(', ') + '</span>' : '') + '</div>' +
        (l.length ? l.map(function (b) { var t = tone(b.studentId); return '<button type="button" class="ag-li" data-bk="' + b.id + '" style="border-color:' + t[1] + ';background:' + t[0] + '"><b>' + range(b, c.tz) + '</b><span>' + esc(sName(b.studentId)) + ' · ' + dur(b) + '</span></button>'; }).join('') : '<div class="small muted">Aucun cours</div>') +
        '<button type="button" class="btn small ghost" data-ag="addday" data-day="' + k + '">+ Ajouter un cours</button></div>';
    }).join('') + '</div>';
  }

  /* ---------- ajout d'un cours ou d'une fermeture ---------- */
  function addModal(opt) {
    opt = opt || {};
    var c = cfgT(), now = Date.now();
    var key = opt.day || C.dayKey(now + DAY, c.tz), time = opt.time != null ? C.hmStr(opt.time) : '18:00';
    var durs = c.durations.slice(); [30, 45, 60, 90, 120, 150, 180].forEach(function (d) { if (durs.indexOf(d) < 0) durs.push(d); }); durs.sort(function (a, b) { return a - b; });
    var S = cache.students.filter(function (s) { return s.active !== false; });
    var m = X.modal('<h2>Ajouter un cours</h2>' +
      '<div class="seg" role="tablist"><button type="button" class="on" data-kind="course">Un cours</button><button type="button" data-kind="block">Une indisponibilité</button></div>' +
      '<form id="agadd" class="stack" style="gap:12px;margin-top:14px">' +
        '<div data-for="course" class="stack" style="gap:12px">' +
          '<label class="f">Élève<select class="in" name="sid">' + (S.length ? S.map(function (s) { return '<option value="' + s.id + '"' + (opt.sid === s.id ? ' selected' : '') + '>' + esc(X.fullName(s)) + '</option>'; }).join('') : '<option value="">Aucun élève</option>') + '</select></label>' +
          '<div class="grid3"><label class="f">Date<input class="in" type="date" name="day" value="' + key + '" required></label>' +
          '<label class="f">Heure<input class="in" type="time" name="time" value="' + time + '" step="300" required></label>' +
          '<label class="f">Durée<select class="in" name="dur">' + durs.map(function (d) { return '<option value="' + d + '"' + (d === (c.durations.indexOf(60) >= 0 ? 60 : c.durations[0]) ? ' selected' : '') + '>' + C.durLabel(d) + '</option>'; }).join('') + '</select></label></div>' +
          '<label class="f">Note <span class="muted" style="font-weight:500">(facultatif, visible par l\'élève)</span><input class="in" name="note" maxlength="500" placeholder="ex. révision du passé, lien de la visio…"></label>' +
        '</div>' +
        '<div data-for="block" class="stack" style="gap:12px" hidden>' +
          '<div class="grid2"><label class="f">Du<input class="in" type="date" name="bday" value="' + key + '"></label><label class="f">à<input class="in" type="time" name="btime" value="' + time + '" step="300"></label>' +
          '<label class="f">Au<input class="in" type="date" name="eday" value="' + key + '"></label><label class="f">à<input class="in" type="time" name="etime" value="' + C.hmStr(Math.min(1439, C.hm(time) + 120)) + '" step="300"></label></div>' +
          '<label class="f">Motif <span class="muted" style="font-weight:500">(pour vous)</span><input class="in" name="bnote" maxlength="120" placeholder="ex. rendez-vous, vacances"></label>' +
          '<p class="small muted" style="margin:0">Aucun élève ne pourra réserver pendant cette période. Pour des vacances de plusieurs jours, utilisez « Fermetures » dans Disponibilités.</p>' +
        '</div>' +
        '<div id="agadd-msg"></div>' +
        '<div class="row"><button class="btn primary" type="submit" id="agadd-go">Ajouter le cours</button>' + (c.tz !== LOCAL_TZ ? '<span class="small muted">Heure de ' + esc(C.tzCity(c.tz)) + '</span>' : '') + '</div>' +
      '</form>');
    var f = $('#agadd', m), kind = 'course';
    $$('.seg button', m).forEach(function (b) {
      b.onclick = function () {
        kind = b.dataset.kind;
        $$('.seg button', m).forEach(function (x) { x.classList.toggle('on', x === b); });
        $$('[data-for]', m).forEach(function (x) { x.hidden = x.dataset.for !== kind; });
        $('#agadd-go', m).textContent = kind === 'course' ? 'Ajouter le cours' : 'Bloquer ce créneau';
        $('h2', m).textContent = kind === 'course' ? 'Ajouter un cours' : 'Bloquer un créneau';
        hint();
      };
    });
    function at(dayV, timeV) {
      var d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(dayV || ''), t = C.hm(timeV);
      return d && t != null ? C.zoned(+d[1], +d[2], +d[3], Math.floor(t / 60), t % 60, c.tz) : NaN;
    }
    function hint() {
      var box = $('#agadd-msg', m); box.innerHTML = '';
      if (kind !== 'course') return;
      var s = at(f.day.value, f.time.value), e = s + +f.dur.value * MIN;
      if (!isFinite(s)) return;
      var clash = booked().filter(function (b) { return b.start < e && b.end > s; })[0];
      if (clash) { box.innerHTML = '<div class="err">Chevauche le cours de ' + esc(sName(clash.studentId)) + ' (' + range(clash, c.tz) + ').</div>'; return; }
      var inside = C.windows(c, f.day.value).some(function (w) { return s >= w.s && e <= w.e; });
      if (!inside) box.innerHTML = '<div class="small muted">ℹ️ En dehors de vos disponibilités habituelles : le cours sera tout de même ajouté.</div>';
      if (s < now) box.innerHTML = '<div class="small muted">ℹ️ Cette date est passée : le cours sera ajouté à l\'historique.</div>';
    }
    ['day', 'time', 'dur'].forEach(function (n) { f[n].addEventListener('change', hint); });
    hint();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = $('button[type=submit]', f), p;
      if (kind === 'course') {
        if (!f.sid.value) return;
        var s = at(f.day.value, f.time.value);
        if (!isFinite(s)) return;
        p = HPB.addBooking({ studentId: f.sid.value, start: s, end: s + +f.dur.value * MIN, note: f.note.value.trim(), by: 'teacher' }).then(function (b) {
          cache.bookings = (cache.bookings || []).concat([b]);
          X.toast('Cours ajouté pour ' + (student(b.studentId) || { first: '' }).first);
        });
      } else {
        var bs = at(f.bday.value, f.btime.value), be = at(f.eday.value, f.etime.value);
        if (!isFinite(bs) || !isFinite(be) || be <= bs) { $('#agadd-msg', m).innerHTML = '<div class="err">La fin doit être après le début.</div>'; return; }
        p = saveCfg(function (cfg) { cfg.blocks.push({ s: new Date(bs).toISOString(), e: new Date(be).toISOString(), note: f.bnote.value.trim() }); }).then(function () { X.toast('Indisponibilité ajoutée'); });
      }
      X.busy(btn, p, 'Ajout impossible').then(function () { m.remove(); X.render(); }).catch(function (e) {
        if (e && e.code === 'taken') $('#agadd-msg', m).innerHTML = '<div class="err">Ce créneau chevauche un autre cours.</div>';
      });
    });
    return m;
  }

  /* ---------- détail d'un cours ---------- */
  function bookingModal(b) {
    var c = cfgT(), s = student(b.studentId), past = b.end < Date.now();
    var msg = s ? 'Shalom ' + s.first + ' ! Petit rappel : cours d\'hébreu ' + fFull(b.start, c.tz) + ' (heure de ' + C.tzCity(c.tz) + ', ' + dur(b) + '). À bientôt, Mayane' : '';
    var m = X.modal('<h2>' + esc(sName(b.studentId)) + '</h2>' +
      '<div class="ag-detail"><div><span>Date</span><b>' + esc(cap(fDay(b.start, c.tz))) + '</b></div><div><span>Horaire</span><b>' + range(b, c.tz) + ' · ' + dur(b) + '</b></div>' +
      '<div><span>Réservé</span><b>' + (b.by === 'student' ? 'par l\'élève' : 'par vous') + (b.createdAt ? ', le ' + esc(fShort(Date.parse(b.createdAt), c.tz)) : '') + '</b></div>' +
      (b.status === 'cancelled' ? '<div><span>Statut</span><b style="color:var(--rose)">Annulé ' + (b.cancelledBy === 'student' ? 'par l\'élève' : 'par vous') + '</b></div>' : '') +
      (b.note ? '<div><span>Note</span><b>' + esc(b.note) + '</b></div>' : '') + '</div>' +
      (s && !past && b.status === 'booked' && (s.phone || s.email) ? '<p class="small muted" style="margin:14px 0 6px">Envoyer un rappel</p><div class="row">' +
        (s.phone ? '<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/' + s.phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a><a class="btn small" href="sms:' + encodeURIComponent(s.phone.replace(/\s/g, '')) + '?&body=' + encodeURIComponent(msg) + '">SMS</a>' : '') +
        (s.email ? '<a class="btn small" href="mailto:' + encodeURIComponent(s.email) + '?subject=' + encodeURIComponent('Rappel — cours d\'hébreu') + '&body=' + encodeURIComponent(msg) + '">E-mail</a>' : '') + '</div>' : '') +
      '<div class="row" style="margin-top:18px">' + (b.status === 'booked' && !past ? calMenu(b, 'Hébreu · ' + sName(b.studentId), [b.note ? 'Note : ' + b.note : '', s && s.phone ? 'Tél. : ' + s.phone : ''].filter(Boolean).join('\n')) : '') +
        (s ? '<a class="btn small" href="#/eleve/' + s.id + '/cours">Fiche de ' + esc(s.first) + '</a>' : '') +
        (b.status === 'booked' ? '<button class="btn small danger" data-cancel>' + (past ? 'Retirer de l\'historique' : 'Annuler ce cours') + '</button>' : '') + '</div>');
    $$('a[href^="#/"]', m).forEach(function (a) { a.addEventListener('click', function () { m.remove(); }); });
    bindCalMenus(m);
    var cb = $('[data-cancel]', m);
    if (cb) cb.onclick = function () {
      if (!cb.dataset.armed) { cb.dataset.armed = 1; cb.textContent = 'Confirmer l\'annulation'; return; }
      X.busy(cb, HPB.cancelBooking(b.id, 'teacher'), 'Annulation impossible').then(function () {
        b.status = 'cancelled'; b.cancelledBy = 'teacher'; b.cancelledAt = new Date().toISOString();
        m.remove(); X.toast('Cours annulé' + (s ? ' — pensez à prévenir ' + s.first : '')); X.render();
      }).catch(function () {});
    };
  }
  function blockModal(sIso) {
    var c = cfgT(), b = c.blocks.filter(function (x) { return x.s === sIso; })[0];
    if (!b) return;
    var s = Date.parse(b.s), e = Date.parse(b.e);
    var m = X.modal('<h2>' + esc(b.note || 'Indisponibilité') + '</h2><p class="muted">Du ' + esc(fFull(s, c.tz)) + '<br>au ' + esc(fFull(e, c.tz)) + '</p>' +
      '<div class="row"><button class="btn danger small" data-del>Supprimer cette indisponibilité</button></div>');
    $('[data-del]', m).onclick = function () {
      X.busy(this, saveCfg(function (cfg) { cfg.blocks = cfg.blocks.filter(function (x) { return x.s !== sIso; }); }), 'Suppression impossible')
        .then(function () { m.remove(); X.render(); }).catch(function () {});
    };
  }
  /* modifie et enregistre les réglages de l'agenda */
  function saveCfg(fn) {
    var cfg = cfgT(); fn(cfg); cfg = C.norm(cfg);
    var prev = cache.settings.agenda;
    cache.settings.agenda = cfg;
    return HPB.setSettings(cache.settings).catch(function (e) { cache.settings.agenda = prev; throw e; });
  }

  /* ---------- page Disponibilités ---------- */
  function availPage() {
    var c = cfgT();
    if (!draft) draft = JSON.parse(JSON.stringify(c));
    var sel = function (name, opts, v) { return '<select class="in" name="' + name + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (+o[0] === +v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
    var tzs = TZS.slice(); if (!tzs.some(function (t) { return t[0] === draft.tz; })) tzs.unshift([draft.tz, C.tzCity(draft.tz)]);
    if (!tzs.some(function (t) { return t[0] === LOCAL_TZ; })) tzs.push([LOCAL_TZ, C.tzCity(LOCAL_TZ) + ' (cet appareil)']);
    var now = Date.now(), blocks = c.blocks.filter(function (b) { return Date.parse(b.e) > now - 7 * DAY; }).sort(function (a, b) { return Date.parse(a.s) - Date.parse(b.s); });
    var origin = HPB.remote ? location.origin : '', feedUrl = c.feed && origin ? origin + '/api/agenda?feed=' + c.feed : '';
    return '<a class="back" href="#/agenda">← Agenda</a><div class="bo-head"><div><h1 class="page-title">Disponibilités</h1><p>Vos élèves ne voient que les créneaux libres, jamais le nom des autres élèves.</p></div></div>' +
      '<form id="agf" class="stack">' +
      '<div class="card"><label class="ag-switch"><input type="checkbox" name="open"' + (draft.open ? ' checked' : '') + '><span></span><b>Les élèves peuvent réserver en ligne</b></label>' +
        '<p class="small muted" style="margin:8px 0 0">Fermée, la réservation disparaît de l\'espace des élèves (ils voient toujours les cours que vous leur avez ajoutés).</p></div>' +
      '<div class="two">' +
        '<div class="card"><h3>Heures de cours habituelles</h3><div id="ag-week">' + weekEditor() + '</div>' +
          '<label class="f" style="margin-top:14px">Fuseau horaire de ces heures<select class="in" name="tz">' + tzs.map(function (t) { return '<option value="' + esc(t[0]) + '"' + (t[0] === draft.tz ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('') + '</select></label>' +
          '<p class="small muted" style="margin:6px 0 0">Chaque élève voit les horaires à l\'heure de son propre appareil (pratique entre la France et Israël).</p></div>' +
        '<div class="stack" style="gap:18px">' +
          '<div class="card"><h3>Durées proposées</h3><div class="chips" id="ag-durs">' + durChips() + '</div>' +
            '<div class="row" style="margin-top:12px">' + sel('adddur', [[0, 'Ajouter une durée…'], [30, '30 min'], [45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30'], [105, '1 h 45'], [120, '2 h'], [150, '2 h 30'], [180, '3 h']], 0) + '</div></div>' +
          '<div class="card"><h3>Règles de réservation</h3><div class="stack" style="gap:12px">' +
            '<label class="f">Un créneau commence toutes les' + sel('step', [[15, '15 minutes'], [30, '30 minutes'], [60, 'heures pleines']], draft.step) + '</label>' +
            '<label class="f">Réservation au plus tard' + sel('notice', [[0, 'jusqu\'au dernier moment'], [2, '2 h avant'], [6, '6 h avant'], [12, '12 h avant'], [24, 'la veille (24 h avant)'], [48, '2 jours avant']], draft.notice) + '</label>' +
            '<label class="f">Réservation possible jusqu\'à' + sel('horizon', [[1, '1 semaine à l\'avance'], [2, '2 semaines'], [4, '4 semaines'], [6, '6 semaines'], [8, '2 mois'], [12, '3 mois']], draft.horizon) + '</label>' +
            '<label class="f">Pause entre deux cours' + sel('buffer', [[0, 'aucune'], [10, '10 min'], [15, '15 min'], [30, '30 min']], draft.buffer) + '</label>' +
            '<label class="f">Annulation en ligne par l\'élève' + sel('cancel', [[0, 'jusqu\'au début du cours'], [12, 'jusqu\'à 12 h avant'], [24, 'jusqu\'à 24 h avant'], [48, 'jusqu\'à 48 h avant'], [336, 'jamais (il vous prévient)']], draft.cancel) + '</label>' +
            '<label class="f">Cours à venir par élève' + sel('maxUpcoming', [[0, 'sans limite'], [1, '1 à la fois'], [2, '2 à la fois'], [3, '3 à la fois'], [4, '4 à la fois'], [8, '8 à la fois']], draft.maxUpcoming) + '</label>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><h3>Message affiché aux élèves</h3><textarea class="in" name="message" rows="3" maxlength="600" placeholder="ex. Les cours ont lieu sur Zoom : https://… — ou chez moi, 12 rue…">' + esc(draft.message) + '</textarea></div>' +
      '<div class="ag-savebar"><button class="btn primary" type="submit">Enregistrer les disponibilités</button><span id="agf-msg" class="small muted"></span></div>' +
      '</form>' +
      '<div class="two" style="margin-top:18px">' +
        '<div class="card"><h3>Fermetures et vacances</h3>' +
          (blocks.length ? '<ul class="content-list">' + blocks.map(function (b) {
            return '<li><span><b>' + esc(b.note || 'Fermé') + '</b><br><span class="small muted">' + esc(cap(fShort(Date.parse(b.s), c.tz))) + ' ' + fTime(Date.parse(b.s), c.tz) + ' → ' + esc(fShort(Date.parse(b.e), c.tz)) + ' ' + fTime(Date.parse(b.e), c.tz) + '</span></span>' +
              '<button class="btn small ghost" data-rmblk="' + esc(b.s) + '" title="Supprimer">🗑</button></li>';
          }).join('') + '</ul>' : '<p class="hp-empty">Aucune fermeture prévue.</p>') +
          '<form id="agblk" class="stack" style="gap:10px;margin-top:14px"><div class="grid2"><label class="f">Du<input class="in" type="date" name="from" required></label><label class="f">Au (inclus)<input class="in" type="date" name="to" required></label></div>' +
          '<label class="f">Motif<input class="in" name="note" maxlength="120" placeholder="ex. Vacances de Hanoukka"></label><div><button class="btn" type="submit">Ajouter la fermeture</button></div></form></div>' +
        '<div class="card"><h3>Voir vos cours dans votre agenda</h3>' +
          (!HPB.remote ? '<p class="small muted">Disponible sur le site en ligne : un lien privé ajoute automatiquement tous vos cours à Google Agenda, Apple Calendrier ou Outlook.</p>' :
          feedUrl ? '<p class="small muted" style="margin-top:-6px">Tous vos cours apparaissent automatiquement dans votre agenda (mise à jour toutes les quelques heures). Ce lien est privé : ne le partagez pas.</p>' +
            '<input class="in mono small" readonly value="' + esc(feedUrl) + '" onclick="this.select()">' +
            '<div class="row" style="margin-top:10px"><button class="btn small" data-copy="' + esc(feedUrl) + '">Copier le lien</button>' +
            '<a class="btn small" target="_blank" rel="noopener" href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(feedUrl.replace(/^https:/, 'webcal:')) + '">Google Agenda</a>' +
            '<a class="btn small" href="' + esc(feedUrl.replace(/^https:/, 'webcal:')) + '">Apple Calendrier</a>' +
            '<button class="btn small ghost" data-ag="feed">Changer le lien</button></div>' :
            '<p class="small muted" style="margin-top:-6px">Créez un lien privé pour voir automatiquement tous vos cours dans Google Agenda, Apple Calendrier ou Outlook, sur votre téléphone.</p><button class="btn" data-ag="feed">Créer mon lien d\'agenda</button>') +
        '</div>' +
      '</div>';
  }
  function weekEditor() {
    return ORDER.map(function (d) {
      var rs = draft.rules.map(function (r, i) { return [r, i]; }).filter(function (x) { return x[0].d === d; });
      return '<div class="ag-wd"><b>' + cap(DAYS[d]) + '</b><div class="ag-ranges">' +
        (rs.length ? rs.map(function (x) {
          return '<span class="ag-range"><input class="in" type="time" step="900" value="' + x[0].from + '" data-ri="' + x[1] + '" data-k="from" aria-label="Début">' +
            '<span>–</span><input class="in" type="time" step="900" value="' + (x[0].to === '24:00' ? '23:59' : x[0].to) + '" data-ri="' + x[1] + '" data-k="to" aria-label="Fin">' +
            '<button type="button" class="btn small ghost" data-rmr="' + x[1] + '" aria-label="Retirer la plage ' + x[0].from + '–' + x[0].to + '">×</button></span>';
        }).join('') : '<span class="small muted">Fermé</span>') +
        '</div><button type="button" class="btn small" data-addr="' + d + '">+ plage</button></div>';
    }).join('');
  }
  function durChips() {
    return draft.durations.map(function (d) { return '<span class="chip on">' + C.durLabel(d) + (draft.durations.length > 1 ? '<button type="button" data-rmd="' + d + '" aria-label="Retirer ' + C.durLabel(d) + '">×</button>' : '') + '</span>'; }).join('');
  }

  function bindTeacher(sub) {
    var c = cfgT();
    if (sub === 'disponibilites') return bindAvail();
    draft = null;
    var now = Date.now();
    /* semaine hors de la période chargée : on la charge puis on réaffiche */
    if (week && HPB.listBookings && !cache.bkError) {
      var from = C.dayStart(week, c.tz), to = C.dayStart(C.addDaysKey(week, 7), c.tz);
      ensure(from - DAY, to + DAY).then(function (changed) { if (changed) X.render(); }, function () {});
    }
    var go = function (n) { week = n === 0 ? monday(C.dayKey(now, c.tz)) : C.addDaysKey(week, 7 * n); X.render(); };
    $$('[data-ag="prev"]').forEach(function (b) { b.onclick = function () { go(-1); }; });
    $$('[data-ag="next"]').forEach(function (b) { b.onclick = function () { go(1); }; });
    $$('[data-ag="today"]').forEach(function (b) { b.onclick = function () { go(0); }; });
    $$('[data-ag="add"]').forEach(function (b) { b.onclick = function () { addModal(); }; });
    $$('[data-ag="addday"]').forEach(function (b) { b.onclick = function () { addModal({ day: b.dataset.day }); }; });
    $$('[data-bk]').forEach(function (el) {
      el.onclick = function (e) { e.stopPropagation(); var b = (cache.bookings || []).filter(function (x) { return x.id === el.dataset.bk; })[0]; if (b) bookingModal(b); };
    });
    $$('[data-blk]').forEach(function (el) { el.onclick = function (e) { e.stopPropagation(); blockModal(el.dataset.blk); }; });
    $$('.ag-col .ag-body').forEach(function (col) {
      col.addEventListener('click', function (e) {
        if (e.target !== col && !e.target.classList.contains('ag-av') && !e.target.classList.contains('ag-now')) return;
        var r = col.getBoundingClientRect(), m = +col.dataset.lo + (e.clientY - r.top) / PX * 60;
        m = Math.max(0, Math.min(1440 - 30, Math.floor(m / c.step) * c.step));
        addModal({ day: col.dataset.day, time: m });
      });
    });
    if (news().length) setTimeout(setSeen, 1500);   /* les nouveautés restent affichées pendant cette visite */
  }
  function bindAvail() {
    var f = $('#agf');
    if (!f) return;
    function redraw() { $('#ag-week').innerHTML = weekEditor(); $('#ag-durs').innerHTML = durChips(); wire(); dirty(); }
    function dirty() { $('#agf-msg').textContent = 'Modifications non enregistrées'; }
    function wire() {
      $$('#ag-week input[type=time]').forEach(function (inp) {
        inp.onchange = function () { var r = draft.rules[+inp.dataset.ri]; var v = inp.value; if (inp.dataset.k === 'to' && v === '23:59') v = '24:00'; if (r && C.hm(v) != null) r[inp.dataset.k] = v; dirty(); };
      });
      $$('[data-rmr]').forEach(function (b) { b.onclick = function () { draft.rules.splice(+b.dataset.rmr, 1); redraw(); }; });
      $$('[data-addr]').forEach(function (b) {
        b.onclick = function () {
          var d = +b.dataset.addr, last = draft.rules.filter(function (r) { return r.d === d; }).pop();
          var a = last ? Math.min(C.hm(last.to) + 60, 22 * 60) : 17 * 60;
          draft.rules.push({ d: d, from: C.hmStr(a), to: C.hmStr(Math.min(a + 180, 1440)) }); redraw();
        };
      });
      $$('[data-rmd]').forEach(function (b) { b.onclick = function () { draft.durations = draft.durations.filter(function (x) { return x !== +b.dataset.rmd; }); redraw(); }; });
    }
    wire();
    f.adddur.onchange = function () { var v = +f.adddur.value; if (v && draft.durations.indexOf(v) < 0) { draft.durations.push(v); draft.durations.sort(function (a, b) { return a - b; }); } f.adddur.value = 0; redraw(); };
    ['open', 'tz', 'step', 'notice', 'horizon', 'buffer', 'cancel', 'maxUpcoming', 'message'].forEach(function (n) { f[n].addEventListener('change', dirty); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = draft.rules.filter(function (r) { return C.hm(r.to) <= C.hm(r.from); });
      if (bad.length) { $('#agf-msg').innerHTML = '<span class="err">Une plage du ' + DAYS[bad[0].d] + ' finit avant de commencer.</span>'; return; }
      var next = Object.assign({}, draft, {
        open: f.open.checked, tz: f.tz.value, step: +f.step.value, notice: +f.notice.value, horizon: +f.horizon.value, buffer: +f.buffer.value,
        cancel: +f.cancel.value, maxUpcoming: +f.maxUpcoming.value, message: f.message.value.trim()
      });
      if (next.open && !next.rules.length) { $('#agf-msg').innerHTML = '<span class="err">Ajoutez au moins une plage horaire pour ouvrir la réservation.</span>'; return; }
      X.busy($('button[type=submit]', f), saveCfg(function (cfg) { Object.keys(next).forEach(function (k) { if (k !== 'blocks' && k !== 'feed') cfg[k] = next[k]; }); }), 'Enregistrement impossible').then(function () {
        draft = null; X.toast(next.open ? 'Disponibilités enregistrées — vos élèves peuvent réserver' : 'Disponibilités enregistrées'); X.render();
      }).catch(function () {});
    });
    var bf = $('#agblk');
    if (bf) bf.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = cfgT();
      if (!bf.from.value || !bf.to.value || bf.to.value < bf.from.value) { X.toast('La date de fin doit être après celle du début'); return; }
      var s = C.dayStart(bf.from.value, c.tz), en = C.dayStart(C.addDaysKey(bf.to.value, 1), c.tz);
      var hit = booked().filter(function (b) { return b.start < en && b.end > s; });
      X.busy($('button[type=submit]', bf), saveCfg(function (cfg) { cfg.blocks.push({ s: new Date(s).toISOString(), e: new Date(en).toISOString(), note: bf.note.value.trim() || 'Fermé' }); }), 'Ajout impossible').then(function () {
        X.toast(hit.length ? 'Fermeture ajoutée — attention : ' + X.plural(hit.length, 'cours déjà réservé', 'cours déjà réservés') + ' pendant cette période' : 'Fermeture ajoutée', hit.length > 0);
        if (draft) draft.blocks = cfgT().blocks;
        X.render();
      }).catch(function () {});
    });
    $$('[data-rmblk]').forEach(function (b) {
      b.onclick = function () {
        X.busy(b, saveCfg(function (cfg) { cfg.blocks = cfg.blocks.filter(function (x) { return x.s !== b.dataset.rmblk; }); }), 'Suppression impossible')
          .then(function () { if (draft) draft.blocks = cfgT().blocks; X.render(); }).catch(function () {});
      };
    });
    $$('[data-ag="feed"]').forEach(function (b) {
      b.onclick = function () {
        if (cfgT().feed && !b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Confirmer : l\'ancien lien ne marchera plus'; return; }
        X.busy(b, saveCfg(function (cfg) { cfg.feed = rid(); }), 'Création impossible').then(function () { X.toast('Lien d\'agenda créé'); X.render(); }).catch(function () {});
      };
    });
    X.bindCopy(document);
  }

  /* ---------- tableau de bord, fiche élève ---------- */
  function dashboardCard() {
    var c = cfgT(), up = upcoming().slice(0, 5);
    if (!up.length && !c.rules.length && !(cache.bookings || []).length) {
      return '<div class="card ag-intro small-intro"><div class="big">🗓️</div><div><h3>Nouveau : réservation des cours</h3><p class="muted small">Ouvrez vos créneaux : vos élèves réservent eux-mêmes un cours de 1 h, 1 h 30 ou 2 h depuis leur espace.</p><a class="btn small primary" href="#/agenda/disponibilites">Définir mes disponibilités</a></div></div>';
    }
    return '<div class="card"><h3>Prochains cours <small>' + upcoming().length + '</small></h3>' +
      (up.length ? '<div class="ag-next">' + up.map(function (b) {
        var t = tone(b.studentId);
        return '<button type="button" class="ag-li" data-bk="' + b.id + '" style="border-color:' + t[1] + ';background:' + t[0] + '"><b>' + esc(cap(fShort(b.start, c.tz))) + ' · ' + fTime(b.start, c.tz) + '</b><span>' + esc(sName(b.studentId)) + ' · ' + dur(b) + '</span></button>';
      }).join('') + '</div>' : '<p class="hp-empty">Aucun cours réservé pour l\'instant.</p>') +
      '<div class="row" style="margin-top:12px"><a class="btn small" href="#/agenda">Ouvrir l\'agenda</a></div></div>';
  }
  function studentTab(s) {
    var c = cfgT(), now = Date.now();
    var mine = (cache.bookings || []).filter(function (b) { return b.studentId === s.id; });
    var up = mine.filter(function (b) { return b.status === 'booked' && b.end > now; });
    var past = mine.filter(function (b) { return b.end <= now && b.status === 'booked'; }).reverse();
    var canc = mine.filter(function (b) { return b.status === 'cancelled'; }).reverse();
    var row = function (b) {
      return '<li><span><b>' + esc(cap(fDay(b.start, c.tz))) + '</b><br><span class="small muted">' + range(b, c.tz) + ' · ' + dur(b) + (b.note ? ' · ' + esc(b.note) : '') + '</span></span>' +
        '<button class="btn small" data-bk="' + b.id + '">Détails</button></li>';
    };
    return '<div class="two"><div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Cours à venir <small>' + up.length + '</small></h3>' +
        '<button class="btn small primary" data-ag="addfor" data-sid="' + s.id + '">+ Ajouter un cours</button></div>' +
        (up.length ? '<ul class="content-list">' + up.map(row).join('') + '</ul>' : '<p class="hp-empty">Aucun cours à venir.' + (c.open ? ' ' + esc(s.first) + ' peut réserver depuis son espace.' : '') + '</p>') + '</div>' +
      '<div class="card"><h3>Historique <small>' + X.plural(past.length, 'cours', 'cours') + ' · ' + hoursOf(past) + '</small></h3>' +
        (past.length ? '<ul class="content-list">' + past.slice(0, 12).map(row).join('') + '</ul>' : '<p class="hp-empty">Aucun cours passé.</p>') +
        (canc.length ? '<p class="small muted" style="margin-top:12px">' + X.plural(canc.length, 'cours annulé', 'cours annulés') + ' (dont ' + canc.filter(function (b) { return b.cancelledBy === 'student'; }).length + ' par l\'élève).</p>' : '') + '</div></div>';
  }
  function bindStudentTab() {
    $$('[data-ag="addfor"]').forEach(function (b) { b.onclick = function () { addModal({ sid: b.dataset.sid }); }; });
    $$('[data-bk]').forEach(function (el) { el.onclick = function (e) { e.stopPropagation(); var b = (cache.bookings || []).filter(function (x) { return x.id === el.dataset.bk; })[0]; if (b) bookingModal(b); }; });
  }

  /* ================================================================
     CÔTÉ ÉLÈVE
     ================================================================ */
  var P = null;   // panneau ouvert : { sid, st, at, dur, day, el }
  function state(sid) {
    var t0 = Date.now();
    return HPB.agendaState(sid, Date.now() - 120 * DAY, Date.now() + 27 * 7 * DAY).then(function (st) {
      st.cfg = C.norm(st.cfg); st.skew = (st.now || t0) - t0; return st;
    });
  }
  function nowOf(st) { return Date.now() + (st.skew || 0); }
  /* informations pour la barre de l'espace élève : bouton « Mes cours », prochain cours */
  function barInfo(sid) {
    return state(sid).then(function (st) {
      var now = nowOf(st), up = st.mine.filter(function (b) { return b.status === 'booked' && b.end > now; });
      return { show: st.cfg.open || up.length > 0, next: up.length ? 'Prochain cours : ' + fShort(up[0].start) + ' · ' + fTime(up[0].start) : '' };
    }, function () { return { show: false, next: '' }; });
  }
  function openPane(sid, onClose) {
    if (P && P.el && P.el.isConnected) P.el.remove();
    var el = document.createElement('div');
    el.className = 'ag-pane'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Mes cours');
    el.innerHTML = '<div class="ag-pane-in"><div class="ag-ptop"><button type="button" class="btn small" data-close>← Retour à mes révisions</button></div>' +
      '<h1 class="page-title">Mes cours <span class="grad">שִׁעוּרִים</span></h1><div id="ag-pbody"><p class="muted">Chargement…</p></div></div>';
    document.body.appendChild(el);
    document.body.classList.add('ag-open');
    P = { sid: sid, el: el, onClose: onClose, dur: null, day: null };
    var close = function () { el.remove(); document.body.classList.remove('ag-open'); document.removeEventListener('keydown', esc1); P = null; if (onClose) onClose(); };
    function esc1(e) { if (e.key === 'Escape' && !document.querySelector('.modal')) close(); }
    document.addEventListener('keydown', esc1);
    $('[data-close]', el).onclick = close;
    setTimeout(function () { $('[data-close]', el).focus(); }, 30);
    refresh();
  }
  function refresh() {
    if (!P) return Promise.resolve();
    return state(P.sid).then(function (st) { if (!P) return; P.st = st; drawPane(); }, function (e) {
      if (P) $('#ag-pbody', P.el).innerHTML = '<div class="card empty-state"><div class="big">🔌</div><p>' + esc(err(e && e.code, e)) + '</p><button class="btn" data-retry>Réessayer</button></div>';
      var r = P && $('[data-retry]', P.el); if (r) r.onclick = refresh;
    });
  }
  function drawPane() {
    var st = P.st, c = st.cfg, now = nowOf(st), tz = undefined;   // affichage à l'heure de l'appareil
    var up = st.mine.filter(function (b) { return b.status === 'booked' && b.end > now; });
    var past = st.mine.filter(function (b) { return b.status === 'booked' && b.end <= now; }).reverse().slice(0, 6);
    if (!P.dur || c.durations.indexOf(P.dur) < 0) P.dur = c.durations.indexOf(60) >= 0 ? 60 : c.durations[0];
    var html = '';
    html += '<section class="card"><h3>Mes prochains cours <small>' + up.length + '</small></h3>' + (up.length ? '<ul class="ag-mine">' + up.map(function (b) {
      var can = C.canCancel(c, b.start, now);
      return '<li><div class="ag-date"><span>' + esc(fm(tz, { weekday: 'short' }).format(b.start)) + '</span><b>' + esc(fm(tz, { day: 'numeric' }).format(b.start)) + '</b><span>' + esc(fm(tz, { month: 'short' }).format(b.start)) + '</span></div>' +
        '<div class="ag-what"><b>' + range(b, tz) + '</b><span>Cours d\'hébreu avec Mayane · ' + dur(b) + '</span>' + (b.note ? '<i>' + esc(b.note) + '</i>' : '') + '</div>' +
        '<div class="ag-acts">' + calMenu(b, 'Cours d\'hébreu avec Mayane', studentDesc(b, c)) +
        (can ? '<button class="btn small ghost" data-cancel="' + b.id + '">Annuler ce cours</button>' : '<span class="small muted">Pour annuler, préviens Mayane</span>') + '</div></li>';
    }).join('') + '</ul>' : '<p class="hp-empty">Aucun cours prévu pour l\'instant.</p>') + '</section>';
    if (c.open) {
      var all = C.slots(c, st.busy, now, now + c.horizon * 7 * DAY, P.dur, now);
      var byDay = {}, order = [];
      all.forEach(function (t) { var k = C.dayKey(t, LOCAL_TZ); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(t); });
      if (!P.day || !byDay[P.day]) P.day = order[0] || null;
      var maxed = c.maxUpcoming && up.length >= c.maxUpcoming;
      html += '<section class="card"><h3>Réserver un cours</h3>' +
        (c.message ? '<div class="ag-msg">' + linkify(esc(c.message)) + '</div>' : '') +
        (c.tz !== LOCAL_TZ ? '<p class="small muted">Horaires affichés à ton heure (' + esc(C.tzCity(LOCAL_TZ)) + ').</p>' : '') +
        (maxed ? '<p class="ok">Tu as déjà ' + X.plural(up.length, 'cours', 'cours') + ' à venir : c\'est le maximum fixé par Mayane. Tu pourras réserver le suivant après ton prochain cours.</p>' :
        '<p class="small muted" style="margin:0 0 8px">1. Durée du cours</p><div class="ag-durs">' + c.durations.map(function (d) { return '<button type="button" class="chip' + (d === P.dur ? ' on' : '') + '" data-dur="' + d + '" aria-pressed="' + (d === P.dur) + '">' + C.durLabel(d) + '</button>'; }).join('') + '</div>' +
        (order.length ? '<p class="small muted" style="margin:16px 0 8px">2. Jour</p><div class="ag-days" role="group" aria-label="Jours disponibles">' + order.map(function (k) {
          var t = byDay[k][0];
          return '<button type="button" class="ag-day' + (k === P.day ? ' on' : '') + '" data-day="' + k + '" aria-pressed="' + (k === P.day) + '"><span>' + esc(fm(tz, { weekday: 'short' }).format(t)) + '</span><b>' + esc(fm(tz, { day: 'numeric' }).format(t)) + '</b><span>' + esc(fm(tz, { month: 'short' }).format(t)) + '</span><small title="' + X.plural(byDay[k].length, 'créneau libre', 'créneaux libres') + '">' + byDay[k].length + ' libre' + (byDay[k].length > 1 ? 's' : '') + '</small></button>';
        }).join('') + '</div>' +
        '<p class="small muted" style="margin:16px 0 8px">3. Heure — ' + esc(fDay(byDay[P.day][0], tz)) + '</p><div class="ag-slots">' + byDay[P.day].map(function (t) {
          return '<button type="button" class="ag-slot" data-slot="' + t + '">' + fTime(t, tz) + '</button>';
        }).join('') + '</div>'
        : '<p class="hp-empty">Aucun créneau libre de ' + C.durLabel(P.dur) + ' pour le moment' + (c.durations.length > 1 ? ' : essaie une autre durée, ou' : ',') + ' reviens bientôt.</p>')) +
        '</section>';
    } else if (!up.length) {
      html += '<section class="card"><p class="hp-empty">La réservation en ligne n\'est pas ouverte pour le moment. Mayane te proposera tes prochains cours.</p></section>';
    }
    if (past.length) html += '<section class="card"><h3>Cours passés</h3><ul class="content-list">' + past.map(function (b) { return '<li><span>' + esc(cap(fDay(b.start, tz))) + '</span><span class="small muted">' + range(b, tz) + '</span></li>'; }).join('') + '</ul></section>';
    $('#ag-pbody', P.el).innerHTML = '<div class="stack">' + html + '</div>';
    $$('[data-dur]', P.el).forEach(function (b) { b.onclick = function () { P.dur = +b.dataset.dur; P.day = null; drawPane(); }; });
    $$('[data-day]', P.el).forEach(function (b) { b.onclick = function () { P.day = b.dataset.day; drawPane(); var s = $('.ag-slots', P.el); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }; });
    $$('[data-slot]', P.el).forEach(function (b) { b.onclick = function () { confirmBook(+b.dataset.slot); }; });
    bindCalMenus(P.el);
    $$('[data-cancel]', P.el).forEach(function (b) { b.onclick = function () { var x = st.mine.filter(function (y) { return y.id === b.dataset.cancel; })[0]; if (x) confirmCancel(x); }; });
    var day = $('.ag-day.on', P.el); if (day && day.scrollIntoView) day.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  /* menu « Ajouter à mon agenda » : Google, Apple (iPhone, Mac), Outlook, Yahoo, ou fichier .ics pour tout autre agenda */
  function calMenu(b, title, desc, label) {
    var enc = encodeURIComponent, z = function (ms) { return new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, ''); };
    var S = z(b.start), E = z(b.end), iS = new Date(b.start).toISOString(), iE = new Date(b.end).toISOString();
    var ol = function (host) { return 'https://' + host + '/calendar/0/action/compose?rru=addevent&path=%2Fcalendar%2Faction%2Fcompose&subject=' + enc(title) + '&startdt=' + enc(iS) + '&enddt=' + enc(iE) + '&body=' + enc(desc || ''); };
    var ics = 'data:text/calendar;charset=utf-8,' + enc(C.ics([{ uid: b.id, s: b.start, e: b.end, title: title, desc: desc }]));
    var file = 'cours-hebreu-' + C.dayKey(b.start, LOCAL_TZ) + '.ics';
    var links = [
      ['Google Agenda', 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(title) + '&dates=' + S + '/' + E + '&details=' + enc(desc || ''), 'g'],
      ['Apple Calendrier (iPhone, iPad, Mac)', ics, 'a'],
      ['Outlook.com · Hotmail', ol('outlook.live.com'), 'o'],
      ['Outlook (Microsoft 365, pro)', ol('outlook.office.com'), 'o'],
      ['Yahoo Agenda', 'https://calendar.yahoo.com/?v=60&title=' + enc(title) + '&st=' + S + '&et=' + E + '&desc=' + enc(desc || ''), 'y'],
      ['Autre agenda (fichier .ics)', ics, 'f']
    ];
    return '<details class="ag-addcal"><summary class="btn small">📅 ' + esc(label || 'Ajouter à mon agenda') + '</summary><div class="ag-calmenu" role="menu">' +
      links.map(function (l) {
        return '<a role="menuitem" class="ag-cal-' + l[2] + '" href="' + esc(l[1]) + '"' + (l[1].indexOf('data:') === 0 ? ' download="' + file + '"' : ' target="_blank" rel="noopener"') + '>' + esc(l[0]) + '</a>';
      }).join('') + '</div></details>';
  }
  function bindCalMenus(root) {
    $$('.ag-addcal', root).forEach(function (d) {
      d.addEventListener('toggle', function () { if (d.open) $$('.ag-addcal[open]').forEach(function (x) { if (x !== d) x.open = false; }); });
      $$('a', d).forEach(function (a) { a.addEventListener('click', function () { setTimeout(function () { d.open = false; }, 50); }); });
    });
  }
  function studentDesc(b, c) { return [b.note ? 'Note : ' + b.note : '', c && c.message].filter(Boolean).join('\n\n'); }

  function linkify(s) { return s.replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>'; }); }
  function confirmBook(t) {
    var c = P.st.cfg, e = t + P.dur * MIN, minutes = P.dur;
    var m = X.modal('<h2>Réserver ce cours ?</h2><div class="ag-detail"><div><span>Date</span><b>' + esc(cap(fDay(t))) + '</b></div><div><span>Horaire</span><b>' + fTime(t) + ' – ' + fTime(e) + ' · ' + C.durLabel(minutes) + '</b></div></div>' +
      '<label class="f" style="margin-top:14px">Un mot pour Mayane <span class="muted" style="font-weight:500">(facultatif)</span><textarea class="in" name="note" rows="2" maxlength="500" placeholder="ex. j\'aimerais revoir les verbes au passé"></textarea></label>' +
      (c.cancel < 336 ? '<p class="small muted">Annulation possible en ligne ' + (c.cancel ? 'jusqu\'à ' + c.cancel + ' h avant le cours' : 'jusqu\'au début du cours') + '.</p>' : '') +
      '<div class="row" style="margin-top:14px"><button class="btn primary" data-yes>Confirmer la réservation</button><button class="btn" data-no>Retour</button></div><div id="bk-msg" style="margin-top:10px"></div>');
    $('[data-no]', m).onclick = function () { m.remove(); };
    $('[data-yes]', m).onclick = function () {
      var btn = this;
      btn.disabled = true; btn.textContent = 'Réservation…';
      HPB.agendaBook(P.sid, t, minutes, $('textarea', m).value.trim()).then(function (b) {
        $('.card', m).innerHTML = '<button class="close" aria-label="Fermer">×</button><h2>C\'est réservé ! 🎉</h2><p>' + esc(cap(fDay(b.start))) + ', ' + range(b) + '</p>' +
          '<p class="small muted">Mayane voit ton cours dans son agenda. Ajoute-le aussi au tien :</p><div class="row">' + calMenu(b, 'Cours d\'hébreu avec Mayane', studentDesc(b, c)) + '<button class="btn primary" data-ok>Parfait</button></div>';
        bindCalMenus(m);
        $('[data-ok]', m).onclick = function () { m.remove(); };
        refresh();
      }, function (er) {
        btn.disabled = false; btn.textContent = 'Confirmer la réservation';
        $('#bk-msg', m).innerHTML = '<div class="err">' + esc(err(er && er.code, er)) + '</div>';
        if (er && /taken|unavailable|too_soon/.test(er.code)) { btn.remove(); refresh(); }
      });
    };
  }
  function confirmCancel(b) {
    var m = X.modal('<h2>Annuler ce cours ?</h2><p>' + esc(cap(fDay(b.start))) + ', ' + range(b) + '</p><p class="small muted">Le créneau redeviendra libre pour les autres élèves.</p>' +
      '<div class="row" style="margin-top:14px"><button class="btn danger" data-yes>Oui, annuler</button><button class="btn" data-no>Garder mon cours</button></div><div id="cc-msg" style="margin-top:10px"></div>');
    $('[data-no]', m).onclick = function () { m.remove(); };
    $('[data-yes]', m).onclick = function () {
      var btn = this; btn.disabled = true;
      HPB.agendaCancel(P.sid, b.id).then(function () { m.remove(); X.toast('Cours annulé'); refresh(); }, function (er) {
        btn.disabled = false; $('#cc-msg', m).innerHTML = '<div class="err">' + esc(err(er && er.code, er)) + '</div>';
      });
    };
  }
  function closePane() { if (P && P.el) { P.el.remove(); document.body.classList.remove('ag-open'); P = null; } }

  return {
    load: load, badge: badge, page: page, bind: bindTeacher, dashboardCard: dashboardCard, studentTab: studentTab, bindStudentTab: bindStudentTab,
    upcoming: upcoming, barInfo: barInfo, openPane: openPane, closePane: closePane, addModal: addModal
  };
};
