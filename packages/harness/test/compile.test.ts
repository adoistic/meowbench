import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { CannedClient } from '../src/fake-client.js'
import { runGenerate } from '../src/stages/generate.js'
import { runValidate } from '../src/stages/validate.js'
import { runRender } from '../src/stages/render.js'
import { runJudge } from '../src/stages/judge.js'
import { compileRun } from '../src/stages/compile.js'
import type { ModelSpec, PromptSuite } from '../src/types.js'

const SUITE: PromptSuite = {
  version: 1,
  system: 'Output only SVG markup.',
  prompts: [
    { id: 'minimal', title: 'Minimal', user: 'Draw a minimal cat as an SVG.' },
    { id: 'action', title: 'Action', user: 'Draw a cat riding a bicycle as an SVG.' },
  ],
}
const MODELS: ModelSpec[] = [
  { slug: 'openai/gpt-test', name: 'GPT Test', era: 'current', origin: 'US', license: 'closed' },
  { slug: 'acme/refuser-1', name: 'Refuser', era: 'legacy', origin: 'US', license: 'open' },
]

test('compileRun produces a sorted leaderboard with refusals scored zero', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  const client = new CannedClient()
  const records = await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client })
  const validations = runValidate(runDir, records)
  runRender(runDir, records, validations)
  await runJudge({ runDir, records, validations, suite: SUITE, judgeSlugs: ['j/a', 'j/b', 'j/c'], client })

  const { leaderboard, sampleScores } = compileRun({ runDir, records, validations, suite: SUITE, models: MODELS, runId: 'test-run' })

  expect(leaderboard.entries).toHaveLength(2)
  expect(leaderboard.entries[0].slug).toBe('openai/gpt-test')
  // canned judges: all axes {7,6,8,7} → sample score 7 → meowscore 70
  expect(leaderboard.entries[0].meowscore).toBe(70)
  expect(leaderboard.entries[1].meowscore).toBe(0) // refuser
  expect(leaderboard.entries[1].refusalRate).toBe(1)
  expect(leaderboard.entries[0].perPrompt['minimal']).toEqual({ median: 7, best: 7, samples: 2 })
  expect(sampleScores.filter((s) => s.modelSlug === 'acme/refuser-1').every((s) => s.score === 0)).toBe(true)
})
