import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const FIXTURE = fileURLToPath(new URL('../../../runs/2026-07-04_dev-fixture', import.meta.url))

test('fixture run has a complete leaderboard and assets', () => {
  expect(existsSync(join(FIXTURE, 'leaderboard.json'))).toBe(true)
  const lb = JSON.parse(readFileSync(join(FIXTURE, 'leaderboard.json'), 'utf8'))
  expect(lb.entries.length).toBe(10)
  expect(lb.runId).toBe('2026-07-04_dev-fixture')
  // sorted desc, scores varied (not a flat tie)
  const scores = lb.entries.map((e: { meowscore: number }) => e.meowscore)
  expect([...scores].sort((a: number, b: number) => b - a)).toEqual(scores)
  expect(new Set(scores).size).toBeGreaterThan(5)

  const top = lb.entries[0]
  const dir = top.slug.replaceAll('/', '__')
  expect(existsSync(join(FIXTURE, 'renders', dir, 'minimal', 'sample-1.png'))).toBe(true)
  expect(existsSync(join(FIXTURE, 'generations', dir, 'minimal', 'sample-1.svg'))).toBe(true)
})

test('fixture includes refusals with raw text and an invalid sample', () => {
  const scores = JSON.parse(readFileSync(join(FIXTURE, 'scores.json'), 'utf8'))
  const invalid = scores.filter((s: { valid: boolean }) => !s.valid)
  expect(invalid.length).toBeGreaterThanOrEqual(2)
  // at least one refusal record exists with quotable raw text
  const recPath = join(FIXTURE, 'generations', 'meta-llama__llama-2-70b-chat', 'animation', 'sample-1.json')
  expect(existsSync(recPath)).toBe(true)
  const rec = JSON.parse(readFileSync(recPath, 'utf8'))
  expect(rec.status).toBe('refusal')
  const raw = readFileSync(join(FIXTURE, 'generations', 'meta-llama__llama-2-70b-chat', 'animation', 'sample-1.raw.txt'), 'utf8')
  expect(raw.length).toBeGreaterThan(20)
})
