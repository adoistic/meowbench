import { SELF, env } from 'cloudflare:test'
import { beforeEach, expect, test } from 'vitest'

beforeEach(async () => {
  await env.DB.exec('DELETE FROM votes')
  await env.DB.exec('DELETE FROM standings')
  await env.DB.exec('DELETE FROM entrants')
})

test('standings returns models sorted by rating desc after votes', async () => {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO entrants VALUES ('mA|action|1','mA','action')"),
    env.DB.prepare("INSERT INTO entrants VALUES ('mB|action|1','mB','action')"),
  ])
  await SELF.fetch('https://vote.test/api/vote', {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' },
    body: JSON.stringify({ winnerId: 'mA|action|1', loserId: 'mB|action|1', promptId: 'action' }),
  })
  const res = await SELF.fetch('https://vote.test/api/standings')
  expect(res.status).toBe(200)
  expect(res.headers.get('Cache-Control')).toContain('max-age=60')
  const body = await res.json<{ standings: { model: string; rating: number; wins: number }[] }>()
  expect(body.standings[0].model).toBe('mA')
  expect(body.standings[0].rating).toBe(1516)
  expect(body.standings.find((s) => s.model === 'mB')!.rating).toBe(1484)
})

test('empty standings for a fresh DB', async () => {
  const res = await SELF.fetch('https://vote.test/api/standings')
  const body = await res.json<{ standings: unknown[] }>()
  expect(body.standings).toEqual([])
})

test('unknown route → 404', async () => {
  const res = await SELF.fetch('https://vote.test/nope')
  expect(res.status).toBe(404)
})
