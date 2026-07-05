import { expect, test } from 'vitest'
import { loadRun } from '../src/lib/run-data.js'

test('loads the latest run (dev fixture) with entries, prompts, and samples', () => {
  const run = loadRun()
  expect(run.runId).toBe('2026-07-04_dev-fixture')
  expect(run.entries).toHaveLength(10)
  expect(run.prompts.map((p) => p.id)).toContain('minimal')
  // samples are joined with their scores and asset paths
  const top = run.entries[0]
  const s = run.samplesFor(top.slug)
  expect(s.length).toBe(24)
  const valid = s.find((x) => x.valid)!
  expect(valid.svgUrl).toMatch(/^\/run\/svg\//)
  expect(valid.svgSource).toContain('<svg')
  expect(valid.id).toBe(`${top.slug}|${valid.promptId}|${valid.sample}`)
})

test('bestCatFor returns the highest-scoring valid sample', () => {
  const run = loadRun()
  const best = run.bestCatFor(run.entries[0].slug)!
  expect(best.valid).toBe(true)
  for (const s of run.samplesFor(run.entries[0].slug)) {
    if (s.valid) expect(best.score).toBeGreaterThanOrEqual(s.score)
  }
})

test('shame returns lowest valid cats and quotable refusals', () => {
  const run = loadRun()
  const { worstCats, refusals } = run.shame()
  expect(worstCats.length).toBeGreaterThanOrEqual(6)
  for (let i = 1; i < worstCats.length; i++) expect(worstCats[i].score).toBeGreaterThanOrEqual(worstCats[i - 1].score)
  expect(refusals.length).toBeGreaterThanOrEqual(1)
  expect(refusals[0].quote.length).toBeGreaterThan(20)
  expect(refusals[0].modelName).toBe('Llama 2 70B')
})

test('MEOWBENCH_RUN env overrides run selection', () => {
  process.env.MEOWBENCH_RUN = '2026-07-04_dev-fixture'
  expect(loadRun().runId).toBe('2026-07-04_dev-fixture')
  delete process.env.MEOWBENCH_RUN
})
