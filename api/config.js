/* Indique au site s'il est relié à Supabase (adresse et clé publique, sans rien de secret). */
const sb = require('./_supabase');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(200).json({ remote: false }); return; }
  res.status(200).json({ remote: true, supabaseUrl: sb.URL_, supabaseAnonKey: sb.ANON });
};
