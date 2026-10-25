/* Documents des cours que Maayane a choisi de montrer à un élève (réglage « sharedDocs »).
   L'élève n'a pas accès aux documents ni au stockage : le serveur vérifie qu'il s'agit bien
   d'un de SES documents, partagé par Maayane, puis donne un lien de téléchargement valable 10 minutes. */
const sb = require('./_supabase');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOC_ID = /^[\w-]{1,80}$/;

/* documents partagés avec cet élève, les plus récents d'abord */
async function sharedFor(studentId) {
  const rows = await sb.call('/rest/v1/settings?select=data&id=eq.1');
  const ids = ((rows && rows[0] && rows[0].data && rows[0].data.sharedDocs) || []).filter(function (x) { return DOC_ID.test(String(x)); });
  if (!ids.length) return [];
  const docs = await sb.call('/rest/v1/docs?select=id,name,type,size,path,added_at,students&order=added_at.desc&id=in.(' + ids.map(encodeURIComponent).join(',') + ')');
  return (docs || []).filter(function (d) { return (d.students || []).indexOf(studentId) >= 0; });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const b = await readBody(req);
  const who = await sb.caller(req);
  if (!who || who.role !== 'student' || !UUID.test(who.id)) { res.status(403).json({ error: 'not_student' }); return; }
  try {
    const me = await sb.call('/rest/v1/profiles?select=active&id=eq.' + who.id);
    if (!me || !me[0] || me[0].active === false) { res.status(403).json({ error: 'not_student' }); return; }   /* compte suspendu */
    const docs = await sharedFor(who.id);
    if (b.action === 'list') {
      res.status(200).json({ docs: docs.map(function (d) { return { id: d.id, name: d.name, type: d.type, size: d.size, at: d.added_at }; }) });
      return;
    }
    if (b.action === 'url') {
      const d = docs.filter(function (x) { return x.id === b.id; })[0];
      if (!d) { res.status(404).json({ error: 'not_found' }); return; }
      const path = String(d.path).split('/').map(encodeURIComponent).join('/');
      const r = await sb.call('/storage/v1/object/sign/documents/' + path, { method: 'POST', body: { expiresIn: 600 } });
      const signed = r && (r.signedURL || r.signedUrl);
      if (!signed) throw new Error('lien non créé');
      /* view : lecture sur le site (sans forcer le téléchargement) */
      res.status(200).json({ url: sb.URL_ + '/storage/v1' + signed + (b.view ? '' : (signed.indexOf('?') >= 0 ? '&' : '?') + 'download=' + encodeURIComponent(d.name)) });
      return;
    }
    res.status(400).json({ error: 'invalid' });
  } catch (e) {
    console.error('documents élève', e.message);
    res.status(500).json({ error: 'server', detail: e.message });
  }
};
