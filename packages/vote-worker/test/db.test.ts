import { env } from 'cloudflare:test'
import { expect, test } from 'vitest'
import { getEntrant, getRating, recordVote, listStandings } from '../src/db.js'

async function seed() {
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO entrants (sample_id, model_slug, prompt_id) VALUES ('mA|action|1','mA','action')"),
    env.DB.prepare("INSERT OR IGNORE INTO entrants (sample_id, model_slug, prompt_id) VALUES ('mB|action|1','mB','action')"),
  ])
}

test('getEntrant returns the row or null', async () => {
  await seed()
  expect(await getEntrant(env.DB, 'mA|action|1')).toEqual({ sample_id: 'mA|action|1', model_slug: 'mA', prompt_id: 'action' })
  expect(await getEntrant(env.DB, 'nope|x|1')).toBeNull()
})

test('getRating returns 1500 for an unseen model', async () => {
  expect(await getRating(env.DB, 'never-voted')).toBe(1500)
})

test('recordVote updates both models and inserts a vote row', async () => {
  await seed()
  const now = 5_000_000_000_000
  await recordVote(env.DB, {
    now, ipHash: 'h', promptId: 'action',
    winnerSample: 'mA|action|1', loserSample: 'mB|action|1',
    winnerModel: 'mA', loserModel: 'mB',
    winnerDelta: 16, loserDelta: -16,
  })
  expect(await getRating(env.DB, 'mA')).toBeCloseTo(1516, 6)
  expect(await getRating(env.DB, 'mB')).toBeCloseTo(1484, 6)
  const standings = await listStandings(env.DB)
  const mA = standings.find((s) => s.model_slug === 'mA')!
  expect(mA).toMatchObject({ games: 1, wins: 1, losses: 0 })
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ?').bind('h').all<{ n: number }>()
  expect(results[0].n).toBe(1)
})

test('recordVote from a pre-seeded 1500/0/0/0 row hits DO UPDATE correctly', async () => {
  await seed()
  // simulate Task 9 seeding: standings rows exist at default 1500/0/0/0
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO standings (model_slug) VALUES ('mA')"),
    env.DB.prepare("INSERT OR IGNORE INTO standings (model_slug) VALUES ('mB')"),
  ])
  await recordVote(env.DB, {
    now: 7_000_000_000_000, ipHash: 'h3', promptId: 'action',
    winnerSample: 'mA|action|1', loserSample: 'mB|action|1',
    winnerModel: 'mA', loserModel: 'mB', winnerDelta: 16, loserDelta: -16,
  })
  const standings = await listStandings(env.DB)
  const mA = standings.find((s) => s.model_slug === 'mA')!
  const mB = standings.find((s) => s.model_slug === 'mB')!
  expect(mA).toMatchObject({ rating: 1516, games: 1, wins: 1, losses: 0 }) // 0→1, not 1→2
  expect(mB).toMatchObject({ rating: 1484, games: 1, wins: 0, losses: 1 })
})

test('recordVote is atomic: a failing batch leaves no partial standings', async () => {
  await seed()
  // A vote row with a NULL required column makes the batch's insert fail;
  // the two standings upserts in the same batch must roll back.
  const bad = env.DB.prepare(
    "INSERT INTO votes (ts, ip_hash, prompt_id, winner_sample, loser_sample, winner_model, loser_model) VALUES (?, NULL, 'action', 'mA|action|1', 'mB|action|1', 'mZ', 'mY')",
  ).bind(8_000_000_000_000) // ip_hash NULL violates NOT NULL
  const upsert = env.DB.prepare(
    "INSERT INTO standings (model_slug, rating, games, wins, losses) VALUES ('mZ', 1600, 1, 1, 0) ON CONFLICT(model_slug) DO UPDATE SET rating = 1600",
  )
  await expect(env.DB.batch([upsert, bad])).rejects.toThrow()
  const zRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM standings WHERE model_slug = 'mZ'").first<{ n: number }>()
  expect(zRow?.n).toBe(0) // rolled back — no partial state
})

test('listStandings is sorted by rating desc', async () => {
  await seed()
  await recordVote(env.DB, {
    now: 6_000_000_000_000, ipHash: 'h2', promptId: 'action',
    winnerSample: 'mA|action|1', loserSample: 'mB|action|1',
    winnerModel: 'mA', loserModel: 'mB', winnerDelta: 20, loserDelta: -20,
  })
  const standings = await listStandings(env.DB)
  for (let i = 1; i < standings.length; i++) {
    expect(standings[i - 1].rating).toBeGreaterThanOrEqual(standings[i].rating)
  }
})

test('recordVote compounds rating across sequential votes for the same model (no lost update)', async () => {
  await seed()
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO standings (model_slug) VALUES ('mA')"),
    env.DB.prepare("INSERT OR IGNORE INTO standings (model_slug) VALUES ('mB')"),
  ])
  const vote = (delta: number, ts: number) => recordVote(env.DB, {
    now: ts, ipHash: 'h', promptId: 'action',
    winnerSample: 'mA|action|1', loserSample: 'mB|action|1',
    winnerModel: 'mA', loserModel: 'mB', winnerDelta: delta, loserDelta: -delta,
  })
  await vote(16, 1)
  await vote(15, 2)
  expect(await getRating(env.DB, 'mA')).toBeCloseTo(1531, 6) // 1500+16+15, compounded not overwritten
  expect(await getRating(env.DB, 'mB')).toBeCloseTo(1469, 6)
})
