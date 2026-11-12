/* « Mon compte » de l'élève : prix de l'heure, cours passés de l'agenda, paiements, coordonnées
   pour le virement et lien Zoom. L'élève n'a pas accès à ces tables : le serveur lit seulement
   SES données et les renvoie telles quelles ; le calcul du solde se fait dans la page (même calcul que chez Maayane). */
const sb = require('./_supabase');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const who = await sb.caller(req);
  if (!who || who.role !== 'student' || !UUID.test(who.id)) { res.status(403).json({ error: 'not_student' }); return; }
  try {
    const p = await sb.call('/rest/v1/profiles?select=active,rate,billing_start,zoom_url&id=eq.' + who.id);
    if (!p || !p[0] || p[0].active === false) { res.status(403).json({ error: 'not_student' }); return; }
    const [st, bookings, payments] = await Promise.all([
      sb.call('/rest/v1/settings?select=data&id=eq.1'),
      sb.call('/rest/v1/bookings?select=starts_at,ends_at&status=eq.booked&order=starts_at.desc&limit=1000&student_id=eq.' + who.id + '&ends_at=lt.' + encodeURIComponent(new Date().toISOString())),
      sb.call('/rest/v1/payments?select=id,kind,amount,paid_on,method,note&order=paid_on.desc&limit=1000&student_id=eq.' + who.id)
    ]);
    const bill = (st && st[0] && st[0].data && st[0].data.billing) || {};
    res.status(200).json({
      rate: p[0].rate == null ? null : +p[0].rate, start: p[0].billing_start || null,
      zoom: p[0].zoom_url || bill.zoom || '', currency: bill.currency || '₪', bank: bill.bank || '',
      bookings: (bookings || []).map(function (b) { return { start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }; }),
      payments: (payments || []).map(function (x) { return { id: x.id, kind: x.kind, amount: +x.amount, on: x.paid_on, method: x.method, note: x.note }; })
    });
  } catch (e) {
    console.error('compte élève', e.message);
    res.status(500).json({ error: 'server', detail: e.message });
  }
};
