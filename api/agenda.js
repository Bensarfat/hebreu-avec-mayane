/* Réservation des cours par les élèves (le serveur vérifie tout : créneau ouvert, libre, délais),
   et lien d'abonnement à l'agenda de Maayane (Google Agenda, Apple Calendrier, Outlook).
   POST { action: 'state' | 'book' | 'cancel' }   — élève connecté (jeton Supabase)
   GET  ?feed=<code secret>                        — agenda de Maayane au format .ics */
const crypto = require('crypto');
const sb = require('./_supabase');
const C = require('./_agenda');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = 864e5;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
async function settings() {
  const rows = await sb.call('/rest/v1/settings?select=data&id=eq.1');
  return (rows && rows[0] && rows[0].data && rows[0].data.agenda) || {};
}
/* cours réservés qui touchent l'intervalle [from, to] */
async function booked(from, to, extra) {
  return sb.call('/rest/v1/bookings?select=' + (extra || 'id,starts_at,ends_at') + '&status=eq.booked' +
    '&starts_at=lt.' + encodeURIComponent(new Date(to).toISOString()) + '&ends_at=gt.' + encodeURIComponent(new Date(from).toISOString()) +
    '&order=starts_at.asc&limit=2000');
}
function toBooking(r) {
  return { id: r.id, start: Date.parse(r.starts_at), end: Date.parse(r.ends_at), status: r.status, note: r.note || '',
    by: r.created_by, cancelledBy: r.cancelled_by || null, createdAt: r.created_at, cancelledAt: r.cancelled_at || null };
}
/* élève connecté et actif ? */
async function student(req) {
  const who = await sb.caller(req);
  if (!who || who.role !== 'student') return null;
  const rows = await sb.call('/rest/v1/profiles?select=id,active,first,last&id=eq.' + encodeURIComponent(who.id));
  return rows && rows[0] && rows[0].active !== false ? rows[0] : null;
}
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

async function feed(req, res) {
  const token = String((req.query && req.query.feed) || '');
  const cfg = await settings();
  if (!/^[a-f0-9]{32,64}$/.test(token) || !cfg.feed || !same(cfg.feed, token)) { res.status(404).send('Agenda introuvable'); return; }
  const now = Date.now();
  const rows = await booked(now - 60 * DAY, now + 400 * DAY, 'id,starts_at,ends_at,note,student:profiles(first,last,phone)');
  const ev = rows.map(function (r) {
    const name = r.student ? ((r.student.first || '') + ' ' + (r.student.last || '')).trim() : 'Élève';
    const s = Date.parse(r.starts_at), e = Date.parse(r.ends_at);
    return { uid: r.id, s: s, e: e, title: 'Hébreu · ' + name + ' (' + C.durLabel((e - s) / 60000) + ')',
      desc: [r.note ? 'Note : ' + r.note : '', r.student && r.student.phone ? 'Tél. : ' + r.student.phone : ''].filter(Boolean).join('\n') };
  });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).send(C.ics(ev, 'Cours d\'hébreu'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  try {
    if (req.method === 'GET' && req.query && req.query.feed) return await feed(req, res);
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
    const b = await readBody(req);
    const me = await student(req);
    if (!me) { res.status(401).json({ error: 'not_student' }); return; }
    const raw = await settings(), cfg = C.pub(raw), now = Date.now();

    /* ---- ce que voit l'élève : réglages publics, créneaux occupés (anonymes), ses propres cours ---- */
    if (b.action === 'state') {
      const from = Math.max(now - 120 * DAY, +b.from || now), to = Math.min(now + 27 * 7 * DAY, +b.to || now + cfg.horizon * 7 * DAY);
      const all = await booked(now, now + 27 * 7 * DAY);
      const mine = await sb.call('/rest/v1/bookings?select=*&student_id=eq.' + me.id +
        '&starts_at=gt.' + encodeURIComponent(new Date(from).toISOString()) + '&order=starts_at.asc&limit=200');
      res.status(200).json({
        cfg: cfg, now: now,
        busy: all.filter(function (r) { return Date.parse(r.ends_at) > from && Date.parse(r.starts_at) < to; })
          .map(function (r) { return { s: Date.parse(r.starts_at), e: Date.parse(r.ends_at) }; }),
        mine: mine.map(toBooking)
      });
      return;
    }

    /* ---- réservation ---- */
    if (b.action === 'book') {
      const start = Math.round(+b.start), minutes = Math.round(+b.minutes), note = String(b.note || '').trim().slice(0, 500);
      if (!isFinite(start) || !isFinite(minutes)) { res.status(400).json({ error: 'invalid' }); return; }
      if (cfg.maxUpcoming) {
        const up = await sb.call('/rest/v1/bookings?select=id&status=eq.booked&student_id=eq.' + me.id + '&starts_at=gt.' + encodeURIComponent(new Date(now).toISOString()));
        if (up.length >= cfg.maxUpcoming) { res.status(409).json({ error: 'max_upcoming', max: cfg.maxUpcoming }); return; }
      }
      const busy = (await booked(start - DAY, start + DAY)).map(function (r) { return { s: Date.parse(r.starts_at), e: Date.parse(r.ends_at) }; });
      const why = C.check(cfg, busy, start, minutes, now);
      if (why) { res.status(409).json({ error: why }); return; }
      try {
        const rows = await sb.call('/rest/v1/bookings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: {
          student_id: me.id, starts_at: new Date(start).toISOString(), ends_at: new Date(start + minutes * 60000).toISOString(),
          note: note, created_by: 'student' } });
        res.status(200).json({ booking: toBooking(rows[0]) });
      } catch (e) {
        /* deux réservations au même moment : la base refuse la seconde (contrainte « pas de chevauchement ») */
        if (e.status === 409 || /overlap|exclusion|conflict/i.test(e.message)) { res.status(409).json({ error: 'taken' }); return; }
        throw e;
      }
      return;
    }

    /* ---- annulation par l'élève ---- */
    if (b.action === 'cancel') {
      const id = String(b.id || '');
      if (!UUID.test(id)) { res.status(400).json({ error: 'invalid' }); return; }
      const rows = await sb.call('/rest/v1/bookings?select=*&id=eq.' + id + '&student_id=eq.' + me.id);
      const r = rows && rows[0];
      if (!r || r.status !== 'booked') { res.status(404).json({ error: 'not_found' }); return; }
      if (!C.canCancel(cfg, Date.parse(r.starts_at), now)) { res.status(409).json({ error: 'too_late', hours: cfg.cancel }); return; }
      await sb.call('/rest/v1/bookings?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: { status: 'cancelled', cancelled_by: 'student', cancelled_at: new Date().toISOString() } });
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    console.error('agenda', e.message);
    res.status(502).json({ error: 'server_error' });
  }
};
