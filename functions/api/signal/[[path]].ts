/**
 * Cloudflare Pages Function — WebRTC Signaling Relay
 *
 * Routes:
 *  POST /api/signal/offer/:code   — host posts SDP offer
 *  GET  /api/signal/offer/:code   — guest fetches SDP offer
 *  POST /api/signal/answer/:code  — guest posts SDP answer
 *  GET  /api/signal/answer/:code  — host fetches SDP answer
 *
 * Uses KV for storage with 5-minute TTL (rooms auto-expire)
 * KV binding: SIGNAL_KV
 */

interface Env {
  SIGNAL_KV: KVNamespace
}

const TTL = 300  // 5 minutes

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env, params } = ctx
  const path = (params.path as string[]) || []

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  if (!env.SIGNAL_KV) {
    // KV not configured — fall back to in-memory simulation (dev only)
    return json({ error: 'KV not configured' }, 503)
  }

  // Parse route: ["offer","ABCD12"] or ["answer","ABCD12"]
  const [type, code] = path
  if (!type || !code || !['offer','answer'].includes(type)) {
    return json({ error: 'Invalid path' }, 400)
  }

  const key = `fp:${type}:${code.toUpperCase()}`

  if (request.method === 'POST') {
    const body = await request.json() as any
    if (!body?.sdp) return json({ error: 'Missing sdp' }, 400)
    await env.SIGNAL_KV.put(key, JSON.stringify(body), { expirationTtl: TTL })
    return json({ ok: true })
  }

  if (request.method === 'GET') {
    const val = await env.SIGNAL_KV.get(key)
    if (!val) return json({ sdp: null })
    return json(JSON.parse(val))
  }

  return json({ error: 'Method not allowed' }, 405)
}
