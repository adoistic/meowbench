import { env } from 'cloudflare:test'
import { expect, test } from 'vitest'
import { underRateLimit, MAX_VOTES_PER_MINUTE } from '../src/ratelimit.js'

async function insertVote(ipHash: string, ts: number) {
  await env.DB.prepare(
    "INSERT INTO votes (ts, ip_hash, prompt_id, winner_sample, loser_sample, winner_model, loser_model) VALUES (?, ?, 'p', 'a', 'b', 'ma', 'mb')",
  ).bind(ts, ipHash).run()
}

test('allows a fresh IP', async () => {
  const now = 1_000_000_000_000
  expect(await underRateLimit(env.DB, 'fresh-ip', now)).toBe(true)
})

test('blocks once the per-minute cap is reached', async () => {
  const now = 2_000_000_000_000
  const ip = 'busy-ip'
  for (let i = 0; i < MAX_VOTES_PER_MINUTE; i++) await insertVote(ip, now - i * 100)
  expect(await underRateLimit(env.DB, ip, now)).toBe(false)
})

test('ignores votes older than the window', async () => {
  const now = 3_000_000_000_000
  const ip = 'old-ip'
  for (let i = 0; i < MAX_VOTES_PER_MINUTE; i++) await insertVote(ip, now - 61_000 - i) // all >60s ago
  expect(await underRateLimit(env.DB, ip, now)).toBe(true)
})
