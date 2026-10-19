/* Indique au site s'il est relié à Supabase (adresse et clé publique, sans rien de secret). */
const sb = require('./_supabase');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(200).json({ remote: false }); return; }
  /* garde-fou : ne jamais publier une clé secrète collée par erreur à la place de la clé publique */
  if (/^sb_secret_/.test(sb.ANON) || /service_role/.test(Buffer.from((sb.ANON.split('.')[1] || ''), 'base64').toString())) {
    console.error('SUPABASE_ANON_KEY contient une clé secrète : refus de la publier');
    res.status(500).json({ remote: false, error: 'misconfigured' }); return;
  }
  res.status(200).json({ remote: true, supabaseUrl: sb.URL_, supabaseAnonKey: sb.ANON });
};
