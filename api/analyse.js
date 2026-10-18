/* Fonction serveur Vercel : analyse d'un document de cours par Claude.
   Variables d'environnement (Vercel > Settings > Environment Variables) :
   - ANTHROPIC_API_KEY (obligatoire) : clé créée sur console.anthropic.com
   - ANALYSE_CODE (facultatif) : si défini, le site doit envoyer ce code (Réglages > Code d'analyse)
   - ANALYSE_MODEL (facultatif) : modèle Claude utilisé */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'no_key' }); return; }
  const code = process.env.ANALYSE_CODE;
  if (code && req.headers['x-analyse-code'] !== code) { res.status(401).json({ error: 'bad_code' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  const images = Array.isArray(body && body.images) ? body.images.slice(0, 8) : [];
  if (!prompt || prompt.length > 300000) { res.status(400).json({ error: 'bad_request' }); return; }
  const content = images
    .filter(function (b) { return typeof b === 'string' && b.length < 5e6; })
    .map(function (b) { return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }; })
    .concat([{ type: 'text', text: prompt }]);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANALYSE_MODEL || 'claude-sonnet-5-5', max_tokens: 12000, messages: [{ role: 'user', content: content }] })
    });
    const j = await r.json();
    if (!r.ok) { res.status(502).json({ error: 'api_error', detail: (j && j.error && j.error.message) || ('HTTP ' + r.status) }); return; }
    const text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    res.status(200).json({ text: text, truncated: j.stop_reason === 'max_tokens' });
  } catch (e) {
    res.status(502).json({ error: 'api_unreachable', detail: String(e && e.message || e) });
  }
};
