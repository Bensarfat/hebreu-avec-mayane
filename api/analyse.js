/* Fonction serveur Vercel : analyse d'un document de cours par Claude.
   Variables d'environnement (Vercel > Settings > Environment Variables) :
   - ANTHROPIC_API_KEY (obligatoire) : clé créée sur platform.claude.com
   - ANTHROPIC_WORKSPACE_ID (facultatif) : identifiant du workspace, si la clé n'est rattachée à aucun
   - ANALYSE_MODEL (facultatif) : modèle Claude utilisé
   - ANALYSE_CODE (mode sans Supabase uniquement) : code à saisir dans Réglages ; sans lui, l'analyse est refusée */
const sb = require('./_supabase');
const MAX_IMG = 1500000;     // ≈ 1,1 Mo par image (base64)
const MAX_PROMPT = 300000;   // caractères
const TIMEOUT = 280000;      // la fonction a 300 s (vercel.json)

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'no_key' }); return; }

  /* qui a le droit d'analyser : la professeure connectée (mode en ligne), sinon un code obligatoire */
  if (sb.configured()) {
    const me = await sb.caller(req);
    if (!me || me.role !== 'teacher') { res.status(401).json({ error: 'not_teacher' }); return; }
  } else {
    const code = process.env.ANALYSE_CODE;
    if (!code) { res.status(503).json({ error: 'not_configured' }); return; }
    if (req.headers['x-analyse-code'] !== code) { res.status(401).json({ error: 'bad_code' }); return; }
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  const images = Array.isArray(body && body.images) ? body.images.slice(0, 8) : [];
  if (!prompt || prompt.length > MAX_PROMPT) { res.status(400).json({ error: 'bad_request' }); return; }
  if (images.some(function (b) { return typeof b !== 'string' || b.length > MAX_IMG; })) { res.status(413).json({ error: 'image_too_large' }); return; }
  const content = images
    .map(function (b) { return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }; })
    .concat([{ type: 'text', text: prompt }]);

  const ac = new AbortController();
  const timer = setTimeout(function () { ac.abort(); }, TIMEOUT);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ac.signal,
      headers: Object.assign(
        { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        /* clé créée hors d'un « workspace » de la console Claude : il faut préciser lequel utiliser */
        process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}
      ),
      body: JSON.stringify({ model: process.env.ANALYSE_MODEL || 'claude-sonnet-5-5', max_tokens: 16000, messages: [{ role: 'user', content: content }] })
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      console.error('Anthropic', r.status, j && j.error);
      const busy = r.status === 429 || r.status === 529;
      res.status(busy ? 429 : 502).json({ error: busy ? 'busy' : 'api_error', detail: (j && j.error && j.error.message) || ('HTTP ' + r.status) });
      return;
    }
    const text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    res.status(200).json({ text: text, truncated: j.stop_reason === 'max_tokens' });
  } catch (e) {
    const timeout = e && e.name === 'AbortError';
    console.error('analyse', e);
    res.status(timeout ? 504 : 502).json({ error: timeout ? 'timeout' : 'api_unreachable' });
  } finally {
    clearTimeout(timer);
  }
};
