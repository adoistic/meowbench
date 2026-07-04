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
    winnerRating: 1516, loserRating: 1484,
  })
  expect(await getRating(env.DB, 'mA')).toBeCloseTo(1516, 6)
  expect(await getRating(env.DB, 'mB')).toBeCloseTo(1484, 6)
  const standings = await listStandings(env.DB)
  const mA = standings.find((s) => s.model_slug === 'mA')!
  expect(mA).toMatchObject({ games: 1, wins: 1, losses: 0 })
  const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM votes WHERE ip_hash = ?').bind('h').all<{ n: number }>()
  expect(results[0].n).toBe(1)
})

test('listStandings is sorted by rating desc', async () => {
  await seed()
  await recordVote(env.DB, {
    now: 6_000_000_000_000, ipHash: 'h2', promptId: 'action',
    winnerSample: 'mA|action|1', loserSample: 'mB|action|1',
    winnerModel: 'mA', loserModel: 'mB', winnerRating: 1520, loserRating: 1480,
  })
  const standings = await listStandings(env.DB)
  for (let i = 1; i < standings.length; i++) {
    expect(standings[i - 1].rating).toBeGreaterThanOrEqual(standings[i].rating)
  }
})
