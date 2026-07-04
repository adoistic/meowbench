import { SELF, env } from 'cloudflare:test'
import { beforeEach, expect, test } from 'vitest'

async function seedArena() {
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO entrants VALUES ('mA|action|1','mA','action')"),
    env.DB.prepare("INSERT OR IGNORE INTO entrants VALUES ('mB|action|1','mB','action')"),
    env.DB.prepare("INSERT OR IGNORE INTO entrants VALUES ('mA|minimal|1','mA','minimal')"),
  ])
}

async function vote(winnerId: string, loserId: string, promptId: string, ip = '9.9.9.9') {
  return SELF.fetch('https://vote.test/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ winnerId, loserId, promptId }),
  })
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM votes')
  await env.DB.exec('DELETE FROM standings')
  await env.DB.exec('DELETE FROM entrants')
})

test('a valid vote updates both models and returns new ratings', async () => {
  await seedArena()
  const res = await vote('mA|action|1', 'mB|action|1', 'action')
  expect(res.status).toBe(200)
  const body = await res.json<{ ok: boolean; winner: { model: string; rating: number }; loser: { rating: number } }>()
  expect(body.ok).toBe(true)
  expect(body.winner.model).toBe('mA')
  expect(body.winner.rating).toBe(1516)
  expect(body.loser.rating).toBe(1484)
})

test('unknown sample id → 404', async () => {
  await seedArena()
  const res = await vote('ghost|action|9', 'mB|action|1', 'action')
  expect(res.status).toBe(404)
})

test('prompt mismatch → 400', async () => {
  await seedArena()
  const res = await vote('mA|action|1', 'mB|action|1', 'minimal')
  expect(res.status).toBe(400)
  expect((await res.json<{ error: string }>()).error).toBe('prompt-mismatch')
})

test('same model on both sides → 400', async () => {
  await seedArena()
  await env.DB.prepare("INSERT OR IGNORE INTO entrants VALUES ('mA|action|2','mA','action')").run()
  const res = await vote('mA|action|1', 'mA|action|2', 'action')
  expect(res.status).toBe(400)
  expect((await res.json<{ error: string }>()).error).toBe('same-model')
})

test('same sample id on both sides → 400', async () => {
  await seedArena()
  const res = await vote('mA|action|1', 'mA|action|1', 'action')
  expect(res.status).toBe(400)
})

test('malformed JSON → 400', async () => {
  const res = await SELF.fetch('https://vote.test/api/vote', {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' }, body: 'not json',
  })
  expect(res.status).toBe(400)
})

test('malformed sample id → 400 malformed-id (before DB lookup)', async () => {
  await seedArena()
  const res = await vote('not-a-valid-id', 'mB|action|1', 'action')
  expect(res.status).toBe(400)
  expect((await res.json<{ error: string }>()).error).toBe('malformed-id')
})

test('11th vote in a minute from one IP → 429', async () => {
  await seedArena()
  await env.DB.prepare("INSERT OR IGNORE INTO entrants VALUES ('mB|action|2','mB','action')").run()
  for (let i = 0; i < 10; i++) {
    const r = await vote('mA|action|1', 'mB|action|1', 'action', '5.5.5.5')
    expect(r.status).toBe(200)
  }
  const blocked = await vote('mA|action|1', 'mB|action|1', 'action', '5.5.5.5')
  expect(blocked.status).toBe(429)
  const other = await vote('mA|action|1', 'mB|action|1', 'action', '6.6.6.6')
  expect(other.status).toBe(200)
})

test('oversized body → 413 (before parsing)', async () => {
  const res = await SELF.fetch('https://vote.test/api/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' },
    body: JSON.stringify({ winnerId: 'x'.repeat(3000), loserId: 'y', promptId: 'action' }),
  })
  expect(res.status).toBe(413)
  expect((await res.json<{ error: string }>()).error).toBe('body-too-large')
})

test('CORS preflight returns 204 with allow headers', async () => {
  const res = await SELF.fetch('https://vote.test/api/vote', { method: 'OPTIONS' })
  expect(res.status).toBe(204)
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
})
