import { env } from 'cloudflare:test'
import { expect, test } from 'vitest'

test('migrations create the three tables', async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  ).all<{ name: string }>()
  const names = results.map((r) => r.name)
  expect(names).toContain('entrants')
  expect(names).toContain('standings')
  expect(names).toContain('votes')
})

test('entrants enforces sample_id primary key', async () => {
  await env.DB.prepare("INSERT INTO entrants (sample_id, model_slug, prompt_id) VALUES (?, ?, ?)")
    .bind('m|minimal|1', 'm', 'minimal').run()
  await expect(
    env.DB.prepare("INSERT INTO entrants (sample_id, model_slug, prompt_id) VALUES (?, ?, ?)")
      .bind('m|minimal|1', 'm', 'minimal').run(),
  ).rejects.toThrow()
})
