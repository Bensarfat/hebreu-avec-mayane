/* « ✨ Suggérer un conseil » : Claude propose à Maayane un court conseil pour un élève, à partir des mots
   qu'il rate le plus. Maayane relit et modifie avant d'enregistrer : rien n'est envoyé directement à l'élève.
   Variables d'environnement : ANTHROPIC_API_KEY (comme l'analyse), ANTHROPIC_WORKSPACE_ID et ANALYSE_MODEL (facultatifs). */
const sb = require('./_supabase');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'not_configured' }); return; }
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  const who = await sb.caller(req);
  if (!who || !sb.isStaff(who.role)) { res.status(403).json({ error: 'not_teacher' }); return; }
  const b = await readBody(req);
  const first = clean(b.first, 60) || "l'élève";
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 30).map(function (w) {
    return '- ' + clean(w && w.he, 60) + ' = ' + clean(w && w.fr, 80) + ' (' + (+(w && w.bad) || 0) + ' erreurs)';
  }).join('\n');
  const prompt = 'Voici les mots d\'hébreu que ' + first + ' rate le plus souvent dans ses révisions :\n' + (words || '(aucun mot raté pour l\'instant)') + '\n\n' +
    'Écris un conseil de révision pour ' + first + ', de la part de sa professeure Maayane : 2 ou 3 phrases en français, en tutoyant, chaleureux et concret. ' +
    'Repère un point commun entre ces erreurs si possible (genre, pluriel, racine, confusion entre deux mots…) et donne une astuce précise pour le retenir. ' +
    'Les mots hébreux s\'écrivent sans nikoud. Réponds seulement par le texte du conseil, sans titre ni guillemets.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: Object.assign(
        { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
        process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}
      ),
      body: JSON.stringify({
        model: process.env.ANALYSE_MODEL || 'claude-opus-5-5',
        max_tokens: 4000,
        output_config: { effort: 'low' },
        fallbacks: 'default',   /* si un filtre de sécurité refuse, un autre modèle répond */
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
      if (/credit balance is too low/i.test(msg)) { res.status(402).json({ error: 'no_credit' }); return; }
      throw new Error(msg);
    }
    if (j.stop_reason === 'refusal') { res.status(422).json({ error: 'refused' }); return; }
    const text = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('').trim();
    res.status(200).json({ tip: text.slice(0, 600) });
  } catch (e) {
    console.error('conseil', e.message);
    res.status(500).json({ error: 'server', detail: e.message });
  }
};
