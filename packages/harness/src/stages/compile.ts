import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mean, median, round1 } from '../stats.js'
import { samplePaths } from '../run-store.js'
import { axisMedians } from './judge.js'
import { sampleKey, type ValidationMap } from './validate.js'
import {
  RUBRIC_AXES,
  type GenerationRecord, type Judgment, type Leaderboard, type LeaderboardEntry,
  type ModelSpec, type PromptSuite, type SampleScore,
} from '../types.js'

export interface CompileOpts {
  runDir: string
  records: GenerationRecord[]
  validations: ValidationMap
  suite: PromptSuite
  models: ModelSpec[]
  runId: string
}

export function compileRun(opts: CompileOpts): { leaderboard: Leaderboard; sampleScores: SampleScore[] } {
  const { runDir, records, validations, suite, models, runId } = opts
  const sampleScores: SampleScore[] = []

  for (const r of records) {
    const valid = validations[sampleKey(r)]?.valid ?? false
    let score = 0
    let medians = null
    const judgmentAbs = join(runDir, samplePaths(r.modelSlug, r.promptId, r.sample).judgment)
    if (valid && existsSync(judgmentAbs)) {
      const judgments = JSON.parse(readFileSync(judgmentAbs, 'utf8')) as Judgment[]
      medians = axisMedians(judgments)
      score = mean(RUBRIC_AXES.map((a) => medians![a]))
    }
    sampleScores.push({
      modelSlug: r.modelSlug, promptId: r.promptId, sample: r.sample,
      valid, axisMedians: medians, score: round1(score),
    })
  }

  const entries: LeaderboardEntry[] = models.map((m) => {
    const mine = sampleScores.filter((s) => s.modelSlug === m.slug)
    const myRecords = records.filter((r) => r.modelSlug === m.slug)
    const perPrompt: LeaderboardEntry['perPrompt'] = {}
    for (const p of suite.prompts) {
      const scores = mine.filter((s) => s.promptId === p.id).map((s) => s.score)
      perPrompt[p.id] = scores.length
        ? { median: round1(median(scores)), best: round1(Math.max(...scores)), samples: scores.length }
        : { median: 0, best: 0, samples: 0 }
    }
    // Validation stats are non-null for flagged-but-parseable SVGs by design (display stat, not a scoring gate), so avgElements includes them.
    const elementCounts = myRecords
      .map((r) => validations[sampleKey(r)]?.stats?.elements)
      .filter((n): n is number => typeof n === 'number')
    return {
      slug: m.slug, name: m.name, era: m.era, origin: m.origin, license: m.license,
      meowscore: round1(mean(suite.prompts.map((p) => perPrompt[p.id].median)) * 10),
      perPrompt,
      refusalRate: round1(myRecords.filter((r) => r.status !== 'ok').length / Math.max(1, myRecords.length)),
      avgElements: elementCounts.length ? Math.round(mean(elementCounts)) : null,
    }
  })

  entries.sort((a, b) => b.meowscore - a.meowscore)
  const leaderboard: Leaderboard = { suiteVersion: suite.version, runId, entries }

  writeFileSync(join(runDir, 'scores.json'), JSON.stringify(sampleScores, null, 2))
  writeFileSync(join(runDir, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2))
  return { leaderboard, sampleScores }
}
