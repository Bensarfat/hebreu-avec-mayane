/* =====================================================================
   HPCal — calcul des créneaux de cours (partagé par le navigateur et le serveur).
   Les disponibilités sont saisies à l'heure de Mayane (fuseau « tz ») ;
   les cours sont enregistrés en temps universel et affichés à l'heure de chacun.
   Fichier ignoré par Vercel comme route (il commence par « _ »).
   ===================================================================== */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.HPCal = m;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var MIN = 60000, HOUR = 36e5, DAY = 864e5;
  var DEF = {
    open: false,            // réservation en ligne ouverte aux élèves
    tz: 'Europe/Paris',     // fuseau horaire des disponibilités
    durations: [60, 90, 120],
    step: 30,               // un créneau commence toutes les … minutes
    notice: 12,             // réservation au moins … heures à l'avance
    horizon: 6,             // jusqu'à … semaines à l'avance
    buffer: 0,              // pause entre deux cours (minutes)
    cancel: 24,             // annulation par l'élève jusqu'à … heures avant
    maxUpcoming: 0,         // cours à venir par élève (0 = sans limite)
    message: '',            // mot de Mayane affiché aux élèves (lieu, lien visio…)
    rules: [],              // [{ d: 0-6 (0 = dimanche), from: 'HH:MM', to: 'HH:MM' }]
    blocks: []              // [{ s: ISO, e: ISO, note }] fermetures, vacances
  };
  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function int(v, lo, hi, d) { v = Math.round(+v); return isFinite(v) && v >= lo && v <= hi ? v : d; }
  function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
  function hm(s) { var m = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(String(s || '')); if (!m) return null; var v = +m[1] * 60 + +m[2]; return v <= 1440 ? v : null; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hmStr(v) { return pad(Math.floor(v / 60)) + ':' + pad(v % 60); }

  /* réglages nettoyés : tout ce qui vient du navigateur est vérifié */
  function norm(c) {
    c = c && typeof c === 'object' ? c : {};
    var o = {
      open: !!c.open,
      tz: typeof c.tz === 'string' && validTz(c.tz) ? c.tz : DEF.tz,
      step: [15, 30, 60].indexOf(+c.step) >= 0 ? +c.step : DEF.step,
      notice: int(c.notice, 0, 336, DEF.notice),
      horizon: int(c.horizon, 1, 26, DEF.horizon),
      buffer: int(c.buffer, 0, 120, DEF.buffer),
      cancel: int(c.cancel, 0, 336, DEF.cancel),
      maxUpcoming: int(c.maxUpcoming, 0, 50, DEF.maxUpcoming),
      message: typeof c.message === 'string' ? c.message.slice(0, 600) : '',
      durations: [], rules: [], blocks: []
    };
    (Array.isArray(c.durations) ? c.durations : DEF.durations).forEach(function (d) {
      d = int(d, 15, 480, 0); if (d && o.durations.indexOf(d) < 0 && o.durations.length < 8) o.durations.push(d);
    });
    o.durations.sort(function (a, b) { return a - b; });
    if (!o.durations.length) o.durations = [60];
    (Array.isArray(c.rules) ? c.rules : []).slice(0, 60).forEach(function (r) {
      if (!r) return;
      var d = int(r.d, 0, 6, -1), a = hm(r.from), z = hm(r.to);
      if (d < 0 || a == null || z == null || z <= a) return;
      o.rules.push({ d: d, from: hmStr(a), to: hmStr(z) });
    });
    (Array.isArray(c.blocks) ? c.blocks : []).slice(0, 300).forEach(function (b) {
      if (!b) return;
      var s = Date.parse(b.s), e = Date.parse(b.e);
      if (!isFinite(s) || !isFinite(e) || e <= s) return;
      o.blocks.push({ s: new Date(s).toISOString(), e: new Date(e).toISOString(), note: typeof b.note === 'string' ? b.note.slice(0, 120) : '' });
    });
    if (typeof c.feed === 'string' && /^[a-f0-9]{32,64}$/.test(c.feed)) o.feed = c.feed;
    return o;
  }
  /* ce que voient les élèves (sans le lien privé de l'agenda) */
  function pub(c) { c = norm(c); delete c.feed; return c; }

  /* ---------- fuseaux horaires (sans bibliothèque) ---------- */
  var fmts = {};
  function dtf(tz) {
    return fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  }
  function parts(ms, tz) {
    var o = {};
    dtf(tz).formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: WD[o.weekday] };
  }
  function offset(ms, tz) {          // minutes d'avance du fuseau sur le temps universel
    var p = parts(ms, tz);
    return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / MIN) * MIN) / MIN;
  }
  /* heure locale (dans tz) → instant ; gère les changements d'heure */
  function zoned(y, m, d, h, mi, tz) {
    var g = Date.UTC(y, m - 1, d, h, mi), o1 = offset(g, tz), t = g - o1 * MIN, o2 = offset(t, tz);
    if (o2 !== o1) t = g - o2 * MIN;
    return t;
  }
  function dayKey(ms, tz) { var p = parts(ms, tz); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  /* minuit (dans tz) du jour donné « AAAA-MM-JJ » */
  function dayStart(key, tz) { var p = key.split('-'); return zoned(+p[0], +p[1], +p[2], 0, 0, tz); }
  function addDaysKey(key, n) { var p = key.split('-'); var t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function weekdayOfKey(key) { var p = key.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }

  /* plages d'ouverture d'un jour (dans tz) : [{s, e}] en ms */
  function windows(c, key) {
    var wd = weekdayOfKey(key), p = key.split('-'), out = [];
    c.rules.forEach(function (r) {
      if (r.d !== wd) return;
      var a = hm(r.from), z = hm(r.to);
      var s = zoned(+p[0], +p[1], +p[2], Math.floor(a / 60), a % 60, c.tz);
      var e = z >= 1440 ? dayStart(addDaysKey(key, 1), c.tz) : zoned(+p[0], +p[1], +p[2], Math.floor(z / 60), z % 60, c.tz);
      if (e > s) out.push({ s: s, e: e });
    });
    return out.sort(function (x, y) { return x.s - y.s; });
  }

  /* intervalles occupés : cours réservés (avec la pause) et fermetures */
  function conflicts(c, busy, s, e) {
    var b = c.buffer * MIN, i, x;
    for (i = 0; i < busy.length; i++) { x = busy[i]; if (x.s < e + b && x.e > s - b) return true; }
    for (i = 0; i < c.blocks.length; i++) { x = c.blocks[i]; if (Date.parse(x.s) < e && Date.parse(x.e) > s) return true; }
    return false;
  }

  /* créneaux libres de « minutes » minutes, entre from et to (ms) */
  function slots(c, busy, from, to, minutes, now) {
    c = norm(c); busy = busy || [];
    var lo = Math.max(from, now + c.notice * HOUR), hi = Math.min(to, now + c.horizon * 7 * DAY);
    var out = [], seen = {}, dur = minutes * MIN;
    if (hi <= lo || !minutes) return out;
    var key = dayKey(lo - DAY, c.tz), last = dayKey(hi + DAY, c.tz), guard = 0;
    while (key <= last && guard++ < 400) {
      windows(c, key).forEach(function (w) {
        for (var t = w.s; t + dur <= w.e; t += c.step * MIN) {
          if (t < lo || t >= hi || seen[t]) continue;
          if (conflicts(c, busy, t, t + dur)) continue;
          seen[t] = 1; out.push(t);
        }
      });
      key = addDaysKey(key, 1);
    }
    return out.sort(function (a, b) { return a - b; });
  }

  /* un élève peut-il réserver ce créneau ? null si oui, sinon la raison */
  function check(c, busy, start, minutes, now) {
    c = norm(c);
    if (!c.open) return 'closed';
    if (c.durations.indexOf(minutes) < 0) return 'duration';
    if (start < now + c.notice * HOUR) return 'too_soon';
    if (start > now + c.horizon * 7 * DAY) return 'too_far';
    return slots(c, busy, start - 1, start + 1, minutes, now).indexOf(start) >= 0 ? null : 'unavailable';
  }
  function canCancel(c, start, now) { c = norm(c); return start - now >= c.cancel * HOUR; }

  /* ---------- textes ---------- */
  function durLabel(m) { m = +m; var h = Math.floor(m / 60), r = m % 60; return h ? h + '\u00a0h' + (r ? '\u00a0' + pad(r) : '') : r + '\u00a0min'; }
  function tzCity(tz) { return String(tz || '').split('/').pop().replace(/_/g, ' '); }

  /* ---------- fichier d'agenda (.ics) ---------- */
  function icsDate(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { var out = [], i = 0; while (line.length - i > 60) { out.push((i ? ' ' : '') + line.slice(i, i + 60)); i += 60; } out.push((i ? ' ' : '') + line.slice(i)); return out.join('\r\n'); }
  /* events : [{ uid, s, e, title, desc, cancelled }] */
  function ics(events, name) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hebreu avec Mayane//Agenda//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    if (name) { L.push('X-WR-CALNAME:' + icsText(name)); L.push('REFRESH-INTERVAL;VALUE=DURATION:PT1H'); L.push('X-PUBLISHED-TTL:PT1H'); }
    var stamp = icsDate(Date.now());
    events.forEach(function (ev) {
      L.push('BEGIN:VEVENT', 'UID:' + ev.uid + '@hebreu-avec-mayane', 'DTSTAMP:' + stamp, 'DTSTART:' + icsDate(ev.s), 'DTEND:' + icsDate(ev.e),
        fold('SUMMARY:' + icsText(ev.title)));
      if (ev.desc) L.push(fold('DESCRIPTION:' + icsText(ev.desc)));
      L.push('STATUS:' + (ev.cancelled ? 'CANCELLED' : 'CONFIRMED'), 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  return {
    DEF: DEF, norm: norm, pub: pub, parts: parts, zoned: zoned, offset: offset, dayKey: dayKey, dayStart: dayStart,
    addDaysKey: addDaysKey, weekdayOfKey: weekdayOfKey, windows: windows, conflicts: conflicts, slots: slots, check: check,
    canCancel: canCancel, hm: hm, hmStr: hmStr, durLabel: durLabel, tzCity: tzCity, ics: ics, validTz: validTz
  };
});
