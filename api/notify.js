/* Mails « nouveau cours » aux élèves.
   Variables d'environnement (réglées par Benjamin dans Vercel) :
   - RESEND_API_KEY : clé du service d'envoi de mails Resend (resend.com). Sans elle, aucun mail n'est envoyé et le site fonctionne normalement.
   - MAIL_FROM : expéditeur vérifié chez Resend, par exemple « Maayane <cours@domaine-verifie.fr> ».
   - SITE_URL (facultatif) : adresse du site dans les mails ; sinon, celle de la requête.
   Actions :
   - POST { action: 'docs', students: [id], docs: [noms] } (professeure) : prévient les élèves qui le veulent (un mail au plus toutes les 10 minutes) ;
   - POST { action: 'pref', on: true|false } (élève) : l'élève active ou coupe ses mails ;
   - GET ?unsub=<jeton> : page « ne plus recevoir ces mails », confirmée par un bouton (POST), pour qu'un robot qui ouvre le lien ne désabonne personne. */
const sb = require('./_supabase');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const GAP = 10 * 60 * 1000;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) {}
    return Object.fromEntries(new URLSearchParams(req.body));   /* formulaire du lien de désabonnement */
  }
  return {};
}
function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function site(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return host ? 'https://' + host : '';
}
function page(res, title, body) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.status(200).send('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>body{font:16px/1.5 system-ui,sans-serif;background:#f4f1fb;color:#2a2340;margin:0;padding:24px}main{max-width:440px;margin:40px auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 10px 30px -18px rgba(60,30,120,.4)}' +
    'button{font:700 15px system-ui,sans-serif;border:0;border-radius:999px;padding:10px 18px;background:#6d4bd8;color:#fff;cursor:pointer}a{color:#6d4bd8}</style></head><body><main>' + body + '</main></body></html>');
}

async function send(to, subject, html, text) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: subject, html: html, text: text })
  });
  if (!r.ok) { const t = await r.text().catch(function () { return ''; }); throw new Error('Resend ' + r.status + ' ' + t.slice(0, 200)); }
}
function mail(first, docs, link, unsub) {
  const list = docs.slice(0, 5), more = docs.length - list.length;
  const what = list.length > 1 ? 'de nouveaux cours' : 'un nouveau cours';
  const html = '<div style="font:16px/1.5 Arial,sans-serif;color:#2a2340;max-width:520px">' +
    '<p><span lang="he" dir="rtl">שָׁלוֹם</span> ' + esc(first) + ',</p>' +
    '<p>Maayane a ajouté ' + what + ' à ton espace de révision :</p><ul>' + list.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + (more > 0 ? '<li>et ' + more + ' autre' + (more > 1 ? 's' : '') + '</li>' : '') + '</ul>' +
    '<p><a href="' + esc(link) + '" style="display:inline-block;background:#6d4bd8;color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:10px 18px">Réviser maintenant</a></p>' +
    '<p style="font-size:13px;color:#777">Tu ne veux plus recevoir ces mails ? <a href="' + esc(unsub) + '" style="color:#777">Clique ici</a>, ou coupe-les dans ton espace (📄 Mes documents).</p></div>';
  const text = 'Shalom ' + first + ',\n\nMaayane a ajouté ' + what + ' à ton espace de révision :\n' + list.map(function (d) { return '- ' + d; }).join('\n') + (more > 0 ? '\n- et ' + more + ' autre(s)' : '') +
    '\n\nRéviser maintenant : ' + link + '\n\nNe plus recevoir ces mails : ' + unsub + '\n';
  return { subject: list.length > 1 ? 'Nouveaux cours dans ton espace d\'hébreu' : 'Nouveau cours : ' + list[0], html: html, text: text };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  try {
    /* lien « ne plus recevoir ces mails » */
    const tok = String((req.query && req.query.unsub) || '');
    if (tok) {
      if (!UUID.test(tok)) { page(res, 'Lien invalide', '<p>Ce lien n\'est pas valide.</p>'); return; }
      if (req.method === 'POST') {
        await sb.call('/rest/v1/profiles?notify_token=eq.' + tok, { method: 'PATCH', body: { notify_docs: false }, headers: { Prefer: 'return=minimal' } });
        page(res, 'C\'est noté', '<h1>C\'est noté ✓</h1><p>Tu ne recevras plus de mail quand Maayane ajoute un cours. Tu peux les réactiver dans ton espace (📄 Mes documents).</p><p><a href="' + esc(site(req)) + '">Aller sur le site</a></p>');
        return;
      }
      page(res, 'Ne plus recevoir ces mails', '<h1>Ne plus recevoir ces mails ?</h1><p>Tu ne seras plus prévenu(e) par mail quand Maayane ajoute un cours.</p>' +
        '<form method="post"><button type="submit">Oui, ne plus recevoir ces mails</button></form>');
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
    const b = await readBody(req);
    const who = await sb.caller(req);
    if (!who) { res.status(401).json({ error: 'not_logged_in' }); return; }

    if (b.action === 'pref') {
      if (who.role !== 'student' || !UUID.test(who.id)) { res.status(403).json({ error: 'not_student' }); return; }
      await sb.call('/rest/v1/profiles?id=eq.' + who.id, { method: 'PATCH', body: { notify_docs: !!b.on }, headers: { Prefer: 'return=minimal' } });
      res.status(200).json({ ok: true, on: !!b.on });
      return;
    }

    if (b.action === 'docs') {
      if (!sb.isStaff(who.role)) { res.status(403).json({ error: 'not_teacher' }); return; }
      if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) { res.status(200).json({ sent: 0, reason: 'mail_not_configured' }); return; }
      const ids = (Array.isArray(b.students) ? b.students : []).filter(function (x) { return UUID.test(String(x)); }).slice(0, 200);
      const docs = (Array.isArray(b.docs) ? b.docs : []).map(function (d) { return String(d || '').replace(/[\r\n]+/g, ' ').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 120); }).filter(Boolean).slice(0, 20);
      if (!ids.length || !docs.length) { res.status(200).json({ sent: 0 }); return; }
      const rows = await sb.call('/rest/v1/profiles?select=id,first,email,active,notify_docs,notified_at,notify_token&role=eq.student&id=in.(' + ids.join(',') + ')');
      const now = Date.now(), base = site(req);
      let sent = 0, skipped = 0, failed = 0;
      const details = [];   /* pour chaque élève : ce qui s'est passé (affiché à Maayane) */
      for (const p of rows || []) {
        const st = p.active === false ? 'inactive' : p.notify_docs === false ? 'off' : !EMAIL.test(String(p.email || '').trim()) ? 'no_email'
          : p.notified_at && now - Date.parse(p.notified_at) < GAP ? 'recent' : '';   /* recent : déjà prévenu il y a moins de 10 minutes */
        if (st) { skipped++; details.push({ first: p.first || '', status: st }); continue; }
        const m = mail(p.first || '', docs, base + '/', base + '/api/notify?unsub=' + p.notify_token);
        try {
          await send(String(p.email).trim(), m.subject, m.html, m.text);
          await sb.call('/rest/v1/profiles?id=eq.' + p.id, { method: 'PATCH', body: { notified_at: new Date().toISOString() }, headers: { Prefer: 'return=minimal' } });
          sent++; details.push({ first: p.first || '', status: 'sent' });
        } catch (e) { console.error('mail élève', p.id, e.message); failed++; details.push({ first: p.first || '', status: 'failed', detail: String(e.message || '').slice(0, 200) }); }
      }
      res.status(200).json({ sent: sent, skipped: skipped, failed: failed, details: details });
      return;
    }
    res.status(400).json({ error: 'invalid' });
  } catch (e) {
    console.error('notify', e.message);
    res.status(500).json({ error: 'server', detail: e.message });
  }
};
