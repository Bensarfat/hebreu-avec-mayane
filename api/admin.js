/* Opérations réservées à la professeure, qui demandent la clé « service_role »
   (jamais envoyée au navigateur) : créer / modifier / supprimer un compte élève,
   et créer le compte de la professeure lors de la toute première ouverture. */
const sb = require('./_supabase');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* crée le compte Auth puis le profil ; si le profil échoue, le compte Auth est supprimé (pas de compte orphelin) */
async function createAccount(login, pw, profile) {
  let u;
  try {
    u = await sb.call('/auth/v1/admin/users', { method: 'POST', body: { email: sb.emailFor(login), password: pw, email_confirm: true } });
  } catch (e) {
    if (e.status === 422 || /already/i.test(e.message)) { const t = new Error('login_taken'); t.code = 'login_taken'; throw t; }
    throw e;
  }
  try {
    await sb.call('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: Object.assign({ id: u.id, login: login }, profile) });
  } catch (e) {
    await sb.call('/auth/v1/admin/users/' + u.id, { method: 'DELETE' }).catch(function () {});
    throw e;
  }
  return u.id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const b = await readBody(req);
  try {
    /* ---- première ouverture : y a-t-il déjà un compte professeure ? ---- */
    if (b.action === 'status') { res.status(200).json({ hasTeacher: await sb.hasTeacher() }); return; }

    if (b.action === 'setup') {
      if (await sb.hasTeacher()) { res.status(409).json({ error: 'already_setup' }); return; }
      const login = clean(b.login, 40).toLowerCase(), pw = String(b.pw || '');
      if (!sb.validLogin(login) || pw.length < 8) { res.status(400).json({ error: 'invalid' }); return; }
      await createAccount(login, pw, { role: 'teacher', first: clean(b.first) || 'Maayane' });
      res.status(200).json({ ok: true });
      return;
    }

    /* ---- le reste : professeure connectée uniquement ---- */
    const me = await sb.caller(req);
    if (!me || !sb.isStaff(me.role)) { res.status(401).json({ error: 'not_teacher' }); return; }

    if (b.action === 'save') {
      const s = b.student || {};
      const login = clean(s.login, 40).toLowerCase();
      if (!sb.validLogin(login)) { res.status(400).json({ error: 'invalid_login' }); return; }
      const taken = await sb.call('/rest/v1/profiles?select=id&login=eq.' + encodeURIComponent(login));
      if (taken.some(function (r) { return r.id !== s.id; })) { res.status(409).json({ error: 'login_taken' }); return; }
      const pw = b.pw ? String(b.pw) : '';
      if (pw && pw.length < 6) { res.status(400).json({ error: 'short_password' }); return; }
      const profile = { role: 'student', login: login, first: clean(s.first), last: clean(s.last), email: clean(s.email), phone: clean(s.phone, 40), active: s.active !== false };
      let id = s.id;
      const exists = id && UUID.test(id) && (await sb.call('/rest/v1/profiles?select=id,role&id=eq.' + id)).some(function (r) { return r.role === 'student'; });
      if (!exists) {
        if (!pw) { res.status(400).json({ error: 'password_required' }); return; }
        id = await createAccount(login, pw, profile);
      } else {
        const upd = { email: sb.emailFor(login) };
        if (pw) upd.password = pw;
        await sb.call('/auth/v1/admin/users/' + id, { method: 'PUT', body: upd });
        await sb.call('/rest/v1/profiles?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: profile });
      }
      if (pw) await sb.call('/rest/v1/student_secrets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { student_id: id, pw: pw } });
      res.status(200).json({ ok: true, id: id });
      return;
    }

    if (b.action === 'delete') {
      const id = clean(b.id, 40);
      if (!UUID.test(id)) { res.status(400).json({ error: 'invalid_id' }); return; }
      const rows = await sb.call('/rest/v1/profiles?select=role&id=eq.' + encodeURIComponent(id));
      if (!rows.length || rows[0].role !== 'student') { res.status(404).json({ error: 'not_found' }); return; }
      await sb.call('/auth/v1/admin/users/' + id, { method: 'DELETE' });   // profil, contenu, progression : supprimés en cascade
      res.status(200).json({ ok: true });
      return;
    }

    if (b.action === 'teacher') {
      const login = clean(b.login, 40).toLowerCase(), pw = String(b.pw || '');
      /* mot de passe facultatif : vide = on ne change que l'identifiant */
      if (!sb.validLogin(login) || (pw && pw.length < 8)) { res.status(400).json({ error: 'invalid' }); return; }
      const taken = await sb.call('/rest/v1/profiles?select=id&login=eq.' + encodeURIComponent(login));
      if (taken.some(function (r) { return r.id !== me.id; })) { res.status(409).json({ error: 'login_taken' }); return; }
      const upd = { email: sb.emailFor(login) };
      if (pw) upd.password = pw;
      await sb.call('/auth/v1/admin/users/' + me.id, { method: 'PUT', body: upd });
      await sb.call('/rest/v1/profiles?id=eq.' + me.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { login: login } });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'unknown_action' });
  } catch (e) {
    if (e.code === 'login_taken') { res.status(409).json({ error: 'login_taken' }); return; }
    console.error('admin', b.action, e.status, e.message);
    res.status(502).json({ error: 'server', detail: 'Le serveur n\'a pas pu enregistrer la modification. Réessayez dans un instant.' });
  }
};
