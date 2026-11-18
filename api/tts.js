/* Prononciation des mots en hébreu par une voix de qualité (Google Cloud Text-to-Speech),
   la même pour tous les élèves, quel que soit leur appareil.
   Variables d'environnement (réglées par Benjamin dans Vercel) :
   - GOOGLE_TTS_KEY : clé d'API Google Cloud avec « Cloud Text-to-Speech API » activée. Sans elle, le site garde la voix de l'appareil.
   - TTS_VOICE (facultatif) : voix, par défaut he-IL-Wavenet-A (voix féminine).
   Chaque texte n'est demandé qu'une fois à Google : le son est gardé dans le dossier privé « documents » (sous-dossier tts/). */
const crypto = require('crypto');
const sb = require('./_supabase');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sb.configured()) { res.status(503).json({ error: 'not_configured' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const b = await readBody(req);
  if (b.probe) { res.status(200).json({ ok: !!process.env.GOOGLE_TTS_KEY }); return; }   /* la page demande si la voix est réglée */
  if (!process.env.GOOGLE_TTS_KEY) { res.status(503).json({ error: 'tts_not_configured' }); return; }
  const who = await sb.caller(req);
  if (!who) { res.status(401).json({ error: 'not_logged_in' }); return; }   /* élèves et professeure seulement */
  const text = String(b.text || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 300) { res.status(400).json({ error: 'invalid' }); return; }
  const voice = process.env.TTS_VOICE || 'he-IL-Wavenet-A';
  const path = '/storage/v1/object/documents/tts/' + crypto.createHash('sha256').update(voice + '|' + text).digest('hex') + '.mp3';
  try {
    const cached = await sb.raw(path);
    let audio = cached.ok ? Buffer.from(await cached.arrayBuffer()) : null;
    if (!audio) {
      const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(process.env.GOOGLE_TTS_KEY), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { text: text }, voice: { languageCode: 'he-IL', name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 } })
      });
      const j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.audioContent) throw new Error('Google TTS ' + r.status + ' ' + ((j.error && j.error.message) || '').slice(0, 200));
      audio = Buffer.from(j.audioContent, 'base64');
      await sb.raw(path, { method: 'POST', headers: { 'content-type': 'audio/mpeg', 'x-upsert': 'true' }, body: audio }).catch(function () {});
    }
    res.setHeader('content-type', 'audio/mpeg');
    res.status(200).send(audio);
  } catch (e) {
    console.error('tts', e.message);
    res.status(502).json({ error: 'tts_failed', detail: e.message });
  }
};
