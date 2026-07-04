import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { estimateRun } from '../src/estimate.js'
import { runAll } from '../src/cli.js'
import type { Leaderboard } from '../src/types.js'

test('estimateRun counts calls', () => {
  const est = estimateRun({ modelCount: 30, promptCount: 6, samples: 4, judgeCount: 3 })
  expect(est.generations).toBe(720)
  expect(est.maxJudgeCalls).toBe(2160)
  expect(est.roughUsd).toBeGreaterThan(0)
})

test('runAll --dry-run produces a full run folder offline', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-e2e-'))
  await runAll({
    runDir,
    modelsPath: fileURLToPath(new URL('../../../models.json', import.meta.url)),
    promptsPath: fileURLToPath(new URL('../../../prompts/prompts.json', import.meta.url)),
    samples: 2,
    judgeSlugs: ['judge/a', 'judge/b', 'judge/c'],
    dryRun: true,
  })
  expect(existsSync(join(runDir, 'leaderboard.json'))).toBe(true)
  const lb = JSON.parse(readFileSync(join(runDir, 'leaderboard.json'), 'utf8')) as Leaderboard
  expect(lb.entries.length).toBeGreaterThanOrEqual(2)
  expect(lb.entries[0].meowscore).toBeGreaterThan(0)
  // sorted descending
  const scores = lb.entries.map((e) => e.meowscore)
  expect([...scores].sort((a, b) => b - a)).toEqual(scores)
})
