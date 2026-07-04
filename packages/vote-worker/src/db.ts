import { START_RATING } from './elo.js'

export interface Entrant {
  sample_id: string
  model_slug: string
  prompt_id: string
}

export interface Standing {
  model_slug: string
  rating: number
  games: number
  wins: number
  losses: number
}

export async function getEntrant(db: D1Database, sampleId: string): Promise<Entrant | null> {
  return await db.prepare('SELECT sample_id, model_slug, prompt_id FROM entrants WHERE sample_id = ?')
    .bind(sampleId).first<Entrant>()
}

/** Current rating for a model; START_RATING (1500) if it has no standings row yet. */
export async function getRating(db: D1Database, modelSlug: string): Promise<number> {
  const row = await db.prepare('SELECT rating FROM standings WHERE model_slug = ?').bind(modelSlug).first<{ rating: number }>()
  return row?.rating ?? 1500
}

export interface RecordVoteInput {
  now: number
  ipHash: string
  promptId: string
  winnerSample: string
  loserSample: string
  winnerModel: string
  loserModel: string
  winnerDelta: number // rating change to apply (winner's gain, typically > 0)
  loserDelta: number // rating change to apply (loser's loss, typically < 0)
}

/** Atomically upsert both models' standings and append the vote row.
 * Ratings are stored as a compounded DELTA (`rating = rating + ?`) so SQLite
 * performs the read-modify-write atomically — this prevents the lost-update
 * race two concurrent votes on the same model would otherwise cause. A
 * brand-new model's INSERT branch seeds START_RATING + delta. */
export async function recordVote(db: D1Database, v: RecordVoteInput): Promise<void> {
  const upsertWinner = db.prepare(
    `INSERT INTO standings (model_slug, rating, games, wins, losses) VALUES (?, ?, 1, 1, 0)
     ON CONFLICT(model_slug) DO UPDATE SET rating = rating + ?, games = games + 1, wins = wins + 1`,
  ).bind(v.winnerModel, START_RATING + v.winnerDelta, v.winnerDelta)
  const upsertLoser = db.prepare(
    `INSERT INTO standings (model_slug, rating, games, wins, losses) VALUES (?, ?, 1, 0, 1)
     ON CONFLICT(model_slug) DO UPDATE SET rating = rating + ?, games = games + 1, losses = losses + 1`,
  ).bind(v.loserModel, START_RATING + v.loserDelta, v.loserDelta)
  const insertVote = db.prepare(
    `INSERT INTO votes (ts, ip_hash, prompt_id, winner_sample, loser_sample, winner_model, loser_model)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(v.now, v.ipHash, v.promptId, v.winnerSample, v.loserSample, v.winnerModel, v.loserModel)
  await db.batch([upsertWinner, upsertLoser, insertVote])
}

export async function listStandings(db: D1Database): Promise<Standing[]> {
  const { results } = await db.prepare(
    'SELECT model_slug, rating, games, wins, losses FROM standings ORDER BY rating DESC, model_slug ASC',
  ).all<Standing>()
  return results
}
