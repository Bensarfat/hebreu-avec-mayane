/* Outils partagés par les fonctions serveur (fichier ignoré par Vercel comme route, car il commence par « _ »).
   Variables d'environnement : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. */
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = process.env.SUPABASE_ANON_KEY || '';
const DOMAIN = 'hebreu-avec-mayane.app';

function configured() { return !!(URL_ && SERVICE && ANON); }
function emailFor(login) { return String(login || '').trim().toLowerCase() + '@' + DOMAIN; }
function validLogin(login) { return /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/.test(login) && login.indexOf('..') < 0; }

async function call(path, opts) {
  opts = opts || {};
  /* ancienne clé service_role (JWT « eyJ… ») : aussi en Authorization ; nouvelle clé secrète (sb_secret_…) : en apikey seulement */
  const base = { apikey: SERVICE, 'content-type': 'application/json' };
  if (SERVICE.indexOf('eyJ') === 0) base.Authorization = 'Bearer ' + SERVICE;
  const headers = Object.assign(base, opts.headers || {});
  const r = await fetch(URL_ + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + r.status);
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return data;
}

/* Qui appelle ? Renvoie {id, role} ou null. */
async function caller(req) {
  const h = req.headers.authorization || '';
  const token = h.indexOf('Bearer ') === 0 ? h.slice(7) : '';
  if (!token) return null;
  try {
    const r = await fetch(URL_ + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const u = await r.json();
    const rows = await call('/rest/v1/profiles?select=id,role&id=eq.' + encodeURIComponent(u.id));
    return rows && rows[0] ? { id: rows[0].id, role: rows[0].role } : null;
  } catch (e) { return null; }
}

/* professeure ou administrateur : mêmes droits */
function isStaff(role) { return role === 'teacher' || role === 'admin'; }

async function hasTeacher() {
  const rows = await call('/rest/v1/profiles?select=id&role=eq.teacher&limit=1');
  return !!(rows && rows.length);
}

module.exports = { configured, emailFor, validLogin, call, caller, hasTeacher, isStaff, URL_, ANON };
