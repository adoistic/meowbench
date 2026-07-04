import { getEntrant, getRating, listStandings, recordVote } from './db.js'
import { updateRatings } from './elo.js'
import { hashIp, parseSampleId } from './ids.js'
import { underRateLimit } from './ratelimit.js'

const JSON_HEADERS = { 'content-type': 'application/json' }

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } })
}

interface VoteBody {
  winnerId?: unknown
  loserId?: unknown
  promptId?: unknown
}

/** POST /api/vote — validate, rate-limit, update Elo, record. */
export async function handleVote(req: Request, env: Env, now: number): Promise<Response> {
  let body: VoteBody
  try {
    body = (await req.json()) as VoteBody
  } catch {
    return json({ error: 'invalid-json' }, 400)
  }
  const { winnerId, loserId, promptId } = body
  if (typeof winnerId !== 'string' || typeof loserId !== 'string' || typeof promptId !== 'string') {
    return json({ error: 'missing-fields' }, 400)
  }
  if (winnerId === loserId) return json({ error: 'same-sample' }, 400)
  // Cheap shape check before any DB work — reject obviously-malformed ids as 400
  // (an unknown-but-well-formed id still reaches the DB lookup below and 404s).
  if (!parseSampleId(winnerId) || !parseSampleId(loserId)) return json({ error: 'malformed-id' }, 400)

  const ip = req.headers.get('CF-Connecting-IP') ?? '0.0.0.0'
  const ipHash = await hashIp(ip, env.IP_SALT)
  if (!(await underRateLimit(env.DB, ipHash, now))) {
    return json({ error: 'rate-limited' }, 429)
  }

  const winner = await getEntrant(env.DB, winnerId)
  const loser = await getEntrant(env.DB, loserId)
  if (!winner || !loser) return json({ error: 'unknown-sample' }, 404)
  if (winner.prompt_id !== promptId || loser.prompt_id !== promptId) {
    return json({ error: 'prompt-mismatch' }, 400)
  }
  if (winner.model_slug === loser.model_slug) return json({ error: 'same-model' }, 400)

  const winnerRating = await getRating(env.DB, winner.model_slug)
  const loserRating = await getRating(env.DB, loser.model_slug)
  const updated = updateRatings(winnerRating, loserRating)

  await recordVote(env.DB, {
    now, ipHash, promptId,
    winnerSample: winnerId, loserSample: loserId,
    winnerModel: winner.model_slug, loserModel: loser.model_slug,
    winnerRating: updated.winner, loserRating: updated.loser,
  })

  return json({
    ok: true,
    winner: { model: winner.model_slug, rating: Math.round(updated.winner) },
    loser: { model: loser.model_slug, rating: Math.round(updated.loser) },
  })
}

/** GET /api/standings — edge-cached Elo table. */
export async function handleStandings(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default
  const cacheKey = new Request(new URL(req.url).toString(), { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const standings = (await listStandings(env.DB)).map((s) => ({
    model: s.model_slug,
    rating: Math.round(s.rating),
    games: s.games,
    wins: s.wins,
    losses: s.losses,
  }))
  const res = json({ standings }, 200, { 'Cache-Control': 'public, max-age=60' })
  ctx.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
