// /api/coach — proxy serverless a Gemini per Homebanking.
// La chiave resta lato server (process.env.GEMINI_API_KEY, già deployata su Vercel).
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY non configurata su Vercel' }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Body JSON non valido' }, 400); }

  const { contents = [], system = '', generationConfig = { temperature: 0.7, maxOutputTokens: 800 } } = body;

  const payload = {
    contents: (contents || []).slice(-20),
    generationConfig,
  };
  if (system) payload.systemInstruction = { parts: [{ text: String(system).slice(0, 12000) }] };

  const MAX_RETRIES = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      const d = await r.json();
      if (!r.ok) {
        lastError = d.error?.message || `Errore ${r.status}`;
        if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 400 * attempt)); continue; }
        return json({ error: lastError }, r.status);
      }
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessuna risposta.';
      return json({ text });
    } catch (e) {
      lastError = String(e.message || e);
      await new Promise(s => setTimeout(s, 400 * attempt));
    }
  }
  return json({ error: 'Gemini non raggiungibile: ' + lastError }, 502);
}
