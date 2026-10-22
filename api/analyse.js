/* Fonction serveur Vercel : analyse d'un document de cours par Claude.
   Variables d'environnement (Vercel > Settings > Environment Variables) :
   - ANTHROPIC_API_KEY (obligatoire) : clé créée sur platform.claude.com
   - ANTHROPIC_WORKSPACE_ID (facultatif) : identifiant du workspace, si la clé n'est rattachée à aucun
   - ANALYSE_MODEL (facultatif) : modèle Claude utilisé (par défaut claude-sonnet-5-5)
   - ANALYSE_CODE (mode sans Supabase uniquement) : code à saisir dans Réglages ; sans lui, l'analyse est refusée
   Fonctionnement : réponse diffusée au fil de l'eau (streaming), réflexion préalable coupée (elle consommait
   la longueur de réponse autorisée), JSON garanti par un schéma, nouvelles tentatives si Claude est surchargé.
   Si l'API refuse ces options (400), on refait la demande sous la forme simple d'origine. */
const sb = require('./_supabase');
const MAX_IMG = 1500000;
const MAX_PROMPT = 300000;
const BUDGET = 285000;          // ms of the 300 s Vercel limit we allow ourselves
const URL_API = 'https://api.anthropic.com/v1/messages';

/* JSON schema for output_config.format. "he" (no nikud) is NOT requested: normalise()
   in source/src/analyse.js already derives it with bare(he_nikud). */
const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['themes', 'grammar', 'summary'],
  properties: {
    themes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'words'], properties: {
      name: { type: 'string' },
      words: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['he_nikud', 'fr', 'nature', 'def_he', 'ex_he'], properties: {
        he_nikud: { type: 'string' }, fr: { type: 'string' },
        nature: { type: 'string', enum: ['v', 'n', 'a', 'd', 'o', 'c', 'x'] },
        def_he: { type: 'string' }, ex_he: { type: 'string' } } } } } } },
    grammar: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['category', 'title', 'he', 'html'], properties: {
      category: { type: 'string' }, title: { type: 'string' }, he: { type: 'string' }, html: { type: 'string' } } } },
    summary: { type: 'string' }
  }
};

function thinkingFor(model) {
  if (/^claude-sonnet-5-5/.test(model)) return { type: 'between_tools' };   // Sonnet 5.5 rejects "disabled"
  if (/^claude-haiku-5-5/.test(model)) return { type: 'disabled' };         // Haiku 5.5 accepts it at effort <= high
  return undefined;                                                         // other models: leave default
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* One streamed call. Returns {status, text, stop, usage, error, retryAfter, requestId}. */
async function streamOnce(body, headers, msLeft) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(1000, msLeft));
  let r;
  try {
    r = await fetch(URL_API, { method: 'POST', headers, body: JSON.stringify(Object.assign({}, body, { stream: true })), signal: ac.signal });
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, error: { type: e && e.name === 'AbortError' ? 'deadline' : 'network' } };
  }
  const requestId = r.headers.get('request-id');
  if (!r.ok) {
    clearTimeout(timer);
    const j = await r.json().catch(() => ({}));
    return { status: r.status, error: j.error || { type: 'http_' + r.status }, retryAfter: r.headers.get('retry-after'), requestId };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', stop = null, usage = {}, error = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        if (ev.type === 'message_start') usage = Object.assign({}, ev.message && ev.message.usage);
        else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') text += ev.delta.text;
        else if (ev.type === 'message_delta') { if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; if (ev.usage) Object.assign(usage, ev.usage); /* cumulative */ }
        else if (ev.type === 'error') error = ev.error;
        /* ping, content_block_start/stop, message_stop, thinking/signature deltas, unknown types: ignore */
      }
    }
  } catch (e) {
    if (!(e && e.name === 'AbortError')) error = error || { type: 'network' };
    stop = stop || 'deadline';
  } finally {
    clearTimeout(timer);
  }
  return { status: 200, text, stop, usage, error, requestId };
}

function retryable(res) {
  if (res.status === 200) return !!res.error && !res.text && /overloaded_error|api_error/.test(res.error.type || '');
  if (res.status === 429) return !(res.error && res.error.details && res.error.details.error_code === 'enforced_spend_limit_reached');
  return (res.status === 0 && res.error.type === 'network') || res.status === 500 || res.status === 504 || res.status === 529;
}

module.exports = async function handler(req, res) {
  const t0 = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(503).json({ error: 'no_key' }); return; }

  if (sb.configured()) {
    const me = await sb.caller(req);
    if (!me || !sb.isStaff(me.role)) { res.status(401).json({ error: 'not_teacher' }); return; }
  } else {
    const code = process.env.ANALYSE_CODE;
    if (!code) { res.status(503).json({ error: 'not_configured' }); return; }
    if (req.headers['x-analyse-code'] !== code) { res.status(401).json({ error: 'bad_code' }); return; }
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  /* client now sends {system, prompt, images}: system = static rules (identical for every chunk), prompt = doc name + themes + text */
  const system = body && typeof body.system === 'string' ? body.system : '';
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  const images = Array.isArray(body && body.images) ? body.images.slice(0, 8) : [];
  if (!prompt || prompt.length + system.length > MAX_PROMPT) { res.status(400).json({ error: 'bad_request' }); return; }
  if (images.some((b) => typeof b !== 'string' || b.length > MAX_IMG)) { res.status(413).json({ error: 'image_too_large' }); return; }

  const model = process.env.ANALYSE_MODEL || 'claude-sonnet-5-5';
  const payload = {
    model,
    max_tokens: 32000,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: images
      .map((b) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }))
      .concat([{ type: 'text', text: prompt }]) }]
  };
  const th = thinkingFor(model); if (th) payload.thinking = th;
  if (system) payload.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];

  const headers = Object.assign(
    { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}
  );

  let out, simple = false;
  for (let attempt = 0; ; attempt++) {
    out = await streamOnce(payload, headers, BUDGET - (Date.now() - t0));
    /* options refusées (modèle différent, API plus ancienne…) : on repart sur la forme simple qui a toujours marché */
    if (out.status === 400 && !simple) {
      console.warn('analyse : options refusées, forme simple', out.error && out.error.message);
      simple = true; delete payload.output_config; delete payload.thinking;
      if (payload.system) { payload.messages[0].content[payload.messages[0].content.length - 1].text = system + '\n\n' + prompt; delete payload.system; }
      attempt--; continue;
    }
    if (!retryable(out) || attempt >= 3) break;
    const ra = parseFloat(out.retryAfter);
    const wait = isFinite(ra) ? ra * 1000 : Math.min(8000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
    if (Date.now() - t0 + wait > BUDGET - 30000) break;   // not enough time left for a useful retry
    await sleep(wait);
  }
  console.log('analyse', { model, simple, requestId: out.requestId, status: out.status, stop: out.stop, usage: out.usage, ms: Date.now() - t0 });

  if (out.status !== 200 || (out.error && !out.text)) {
    const s = out.status, e = out.error || {};
    console.error('Anthropic', s, e);
    /* plafond de dépenses du compte Claude atteint : inutile de réessayer, il faut le relever sur la console */
    if ((e.details && e.details.error_code === 'enforced_spend_limit_reached') || /usage limits/i.test(e.message || '')) { res.status(402).json({ error: 'spend_limit' }); return; }
    const busy = s === 429 || s === 529 || e.type === 'overloaded_error';
    const timeout = e.type === 'deadline' || s === 504;
    res.status(busy ? 429 : timeout ? 504 : 502).json({ error: busy ? 'busy' : timeout ? 'timeout' : 'api_error', detail: e.message || ('HTTP ' + s) });
    return;
  }
  if (out.stop === 'refusal') { res.status(422).json({ error: 'refused' }); return; }
  res.status(200).json({
    text: out.text,
    truncated: out.stop === 'max_tokens' || out.stop === 'model_context_window_exceeded' || out.stop === 'deadline' || !!out.error,
    stop_reason: out.stop, usage: out.usage
  });
};

module.exports._test = { streamOnce, retryable, OUTPUT_SCHEMA, thinkingFor };
