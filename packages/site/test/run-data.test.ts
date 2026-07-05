import { expect, test } from 'vitest'
import { loadRun, resolveRunId } from '../src/lib/run-data.js'

test('loads the real run with entries, prompts, and joined samples', () => {
  const run = loadRun()
  expect(run.runId).toBe('2026-07-04_run-001')
  expect(run.entries).toHaveLength(29)
  expect(run.entries[0].name).toBe('GPT-5.5') // real top model
  expect(run.prompts.map((p) => p.id)).toContain('minimal')
  // samples are joined with their scores and asset paths
  const top = run.entries[0]
  const s = run.samplesFor(top.slug)
  expect(s.length).toBe(24) // 6 prompts x 4 attempts
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

test('shame returns lowest valid cats and render failures with reasons', () => {
  const run = loadRun()
  const { worstCats, failures } = run.shame()
  expect(worstCats.length).toBeGreaterThanOrEqual(6)
  for (let i = 1; i < worstCats.length; i++) expect(worstCats[i].score).toBeGreaterThanOrEqual(worstCats[i - 1].score)
  // the real run has no refusals — the modern failure mode is invalid SVGs
  expect(failures.length).toBeGreaterThanOrEqual(1)
  expect(failures.every((f) => !run.samplesFor(f.modelSlug).find((s) => s.id.endsWith(`${f.promptId}|${f.sample}`))?.valid)).toBe(true)
  expect(failures.some((f) => f.reasons.length > 0)).toBe(true)
})

test('MEOWBENCH_RUN env overrides run selection', () => {
  process.env.MEOWBENCH_RUN = '2026-07-04_run-001'
  expect(loadRun().runId).toBe('2026-07-04_run-001')
  delete process.env.MEOWBENCH_RUN
})

test('resolveRunId never auto-selects a placeholder run', () => {
  // guardrail: a run whose name looks synthetic must be skipped, never served
  expect(resolveRunId()).toBe('2026-07-04_run-001')
  expect(resolveRunId()).not.toMatch(/fixture|demo|placeholder|synthetic|mock/i)
})
