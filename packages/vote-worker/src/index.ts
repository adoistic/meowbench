import { handleStandings, handleVote } from './handlers.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))
    const url = new URL(req.url)
    if (req.method === 'POST' && url.pathname === '/api/vote') {
      return withCors(await handleVote(req, env, Date.now()))
    }
    if (req.method === 'GET' && url.pathname === '/api/standings') {
      return withCors(await handleStandings(req, env, ctx))
    }
    return withCors(new Response(JSON.stringify({ error: 'not-found' }), { status: 404, headers: { 'content-type': 'application/json' } }))
  },
}
