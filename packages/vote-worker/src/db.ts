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
  winnerRating: number // already-computed new rating
  loserRating: number
}

/** Atomically upsert both models' standings and append the vote row. */
export async function recordVote(db: D1Database, v: RecordVoteInput): Promise<void> {
  const upsertWinner = db.prepare(
    `INSERT INTO standings (model_slug, rating, games, wins, losses) VALUES (?, ?, 1, 1, 0)
     ON CONFLICT(model_slug) DO UPDATE SET rating = ?, games = games + 1, wins = wins + 1`,
  ).bind(v.winnerModel, v.winnerRating, v.winnerRating)
  const upsertLoser = db.prepare(
    `INSERT INTO standings (model_slug, rating, games, wins, losses) VALUES (?, ?, 1, 0, 1)
     ON CONFLICT(model_slug) DO UPDATE SET rating = ?, games = games + 1, losses = losses + 1`,
  ).bind(v.loserModel, v.loserRating, v.loserRating)
  const insertVote = db.prepare(
    `INSERT INTO votes (ts, ip_hash, prompt_id, winner_sample, loser_sample, winner_model, loser_model)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(v.now, v.ipHash, v.promptId, v.winnerSample, v.loserSample, v.winnerModel, v.loserModel)
  await db.batch([upsertWinner, upsertLoser, insertVote])
}

export async function listStandings(db: D1Database): Promise<Standing[]> {
  const { results } = await db.prepare(
    'SELECT model_slug, rating, games, wins, losses FROM standings ORDER BY rating DESC',
  ).all<Standing>()
  return results
}
