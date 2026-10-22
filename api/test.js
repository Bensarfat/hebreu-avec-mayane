/* Test de niveau public (#/test) : le résultat est enregistré pour Maayane seulement.
   Chaque test devient un petit fichier JSON dans le dossier privé « documents » (Supabase Storage) :
   pas de nouvelle table, rien n'est renvoyé à l'élève.
   action « list » / « delete » : réservées à la professeure (lecture et suppression par le serveur). */
const sb = require('./_supabase');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
const DIR = 'tests-de-niveau';
const LEVELS = ['Embarquement', 'Décollage', 'En vol', 'Atterrissage'];
function pair(v, max) { return Array.isArray(v) && v.length === 2 && v[1] === max && Number.isInteger(v[0]) && v[0] >= 0 && v[0] <= max ? v : null; }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const b = await readBody(req);
  if (b.action === 'list' || b.action === 'delete') {
    const who = await sb.caller(req);
    if (!who || !sb.isStaff(who.role)) { res.status(403).json({ error: 'not_teacher' }); return; }
    try {
      if (b.action === 'delete') {
        if (!/^[\w-]{10,80}$/.test(String(b.id || ''))) { res.status(400).json({ error: 'invalid' }); return; }
        await sb.call('/storage/v1/object/documents', { method: 'DELETE', body: { prefixes: [DIR + '/' + b.id + '.json'] } });
        res.status(200).json({ ok: true }); return;
      }
      const files = await sb.call('/storage/v1/object/list/documents', { method: 'POST', body: { prefix: DIR, limit: 200, offset: 0, sortBy: { column: 'name', order: 'desc' } } });
      const names = (files || []).map(function (f) { return f.name; }).filter(function (n) { return /\.json$/.test(n); }).slice(0, 100);
      const tests = await Promise.all(names.map(function (n) {
        return sb.call('/storage/v1/object/' + 'documents/' + DIR + '/' + n).then(function (r) {
          if (typeof r === 'string') r = JSON.parse(r);
          r.id = n.replace(/\.json$/, ''); return r;
        }).catch(function () { return null; });
      }));
      res.status(200).json({ tests: tests.filter(Boolean) });
    } catch (e) {
      console.error('tests de niveau (liste)', e.message);
      res.status(500).json({ error: 'server', detail: e.message });
    }
    return;
  }
  const name = clean(b.name, 80), contact = clean(b.contact, 120);
  if (!name || contact.length < 5 || LEVELS.indexOf(b.level) < 0) { res.status(400).json({ error: 'invalid' }); return; }
  const s = b.scores || {};
  const rec = {
    v: 1, at: new Date().toISOString(), name: name, contact: contact, level: b.level, reads: b.reads === true,
    scores: { lettres: pair(s.lettres, 3), dec: pair(s.dec, 12), vol: pair(s.vol, 10), att: pair(s.att, 8), lect: pair(s.lect, 5) },
    answers: (Array.isArray(b.answers) ? b.answers : []).slice(0, 40).map(function (a) {
      return { q: Number.isInteger(a && a.q) ? a.q : -1, a: a && a.a != null ? clean(a.a, 60) : null, ok: !!(a && a.ok) };
    }),
    minutes: Number.isFinite(b.minutes) ? Math.max(0, Math.min(600, Math.round(b.minutes))) : null
  };
  const id = rec.at.replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 8);
  try {
    await sb.call('/storage/v1/object/documents/' + DIR + '/' + id + '.json', { method: 'POST', body: rec, headers: { 'content-type': 'application/octet-stream' } });   /* fichier brut : le serveur de fichiers ne cherche pas à lire le JSON */
    res.status(200).json({ ok: true, id: id });
  } catch (e) {
    console.error('test de niveau', e.message);
    res.status(500).json({ error: 'server', detail: e.message });
  }
};
