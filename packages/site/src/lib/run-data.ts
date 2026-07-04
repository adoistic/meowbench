import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { modelDir, sampleId } from './slug.js'

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const RUNS = join(ROOT, 'runs')

export interface PromptSpec { id: string; title: string; user: string }
export interface PerPrompt { median: number; best: number; samples: number }
export interface Entry {
  slug: string; name: string; era: string; origin: string; license: string
  meowscore: number; perPrompt: Record<string, PerPrompt>; refusalRate: number; avgElements: number | null
}
export interface Sample {
  id: string; modelSlug: string; modelName: string; promptId: string; sample: number
  valid: boolean; score: number
  axisMedians: Record<string, number> | null
  pngPath: string | null // public URL path (synced by sync-assets)
  svgSource: string | null
  status: string
}
export interface Refusal { modelSlug: string; modelName: string; promptId: string; quote: string }

export interface RunData {
  runId: string
  suiteVersion: number
  entries: Entry[]
  prompts: PromptSpec[]
  allSamples: Sample[]
  samplesFor(slug: string): Sample[]
  bestCatFor(slug: string): Sample | null
  shame(): { worstCats: Sample[]; refusals: Refusal[] }
}

function pickRunId(): string {
  if (process.env.MEOWBENCH_RUN) return process.env.MEOWBENCH_RUN
  // Invariant: run directory names must sort lexically in chronological order (YYYY-MM-DD prefix);
  // a same-date name sorting before the fixture would silently lose.
  const dirs = readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RUNS, d.name, 'leaderboard.json')))
    .map((d) => d.name)
    .sort()
  if (dirs.length === 0) throw new Error('no runs with a leaderboard.json found under runs/')
  return dirs[dirs.length - 1]
}

let cached: RunData | null = null

export function loadRun(): RunData {
  if (cached && !process.env.MEOWBENCH_RUN) return cached
  const runId = pickRunId()
  const dir = join(RUNS, runId)
  const lb = JSON.parse(readFileSync(join(dir, 'leaderboard.json'), 'utf8')) as { suiteVersion: number; runId: string; entries: Entry[] }
  const scores = JSON.parse(readFileSync(join(dir, 'scores.json'), 'utf8')) as {
    modelSlug: string; promptId: string; sample: number; valid: boolean
    axisMedians: Record<string, number> | null; score: number
  }[]
  const prompts = (JSON.parse(readFileSync(join(ROOT, 'prompts', 'prompts.json'), 'utf8')) as { prompts: PromptSpec[] }).prompts
  const names = new Map(lb.entries.map((e) => [e.slug, e.name]))

  const allSamples: Sample[] = scores.map((s) => {
    const md = modelDir(s.modelSlug)
    const svgAbs = join(dir, 'generations', md, s.promptId, `sample-${s.sample}.svg`)
    const recAbs = join(dir, 'generations', md, s.promptId, `sample-${s.sample}.json`)
    const pngAbs = join(dir, 'renders', md, s.promptId, `sample-${s.sample}.png`)
    const status = existsSync(recAbs) ? (JSON.parse(readFileSync(recAbs, 'utf8')) as { status: string }).status : 'ok'
    return {
      id: sampleId(s.modelSlug, s.promptId, s.sample),
      modelSlug: s.modelSlug,
      modelName: names.get(s.modelSlug) ?? s.modelSlug,
      promptId: s.promptId,
      sample: s.sample,
      valid: s.valid,
      score: s.score,
      axisMedians: s.axisMedians,
      pngPath: existsSync(pngAbs) ? `/run/renders/${md}/${s.promptId}/sample-${s.sample}.png` : null,
      svgSource: existsSync(svgAbs) ? readFileSync(svgAbs, 'utf8') : null,
      status,
    }
  })

  const run: RunData = {
    runId: lb.runId,
    suiteVersion: lb.suiteVersion,
    entries: lb.entries,
    prompts,
    allSamples,
    samplesFor: (slug) => allSamples.filter((s) => s.modelSlug === slug),
    bestCatFor: (slug) => {
      const valid = allSamples.filter((s) => s.modelSlug === slug && s.valid && s.pngPath)
      return valid.length ? valid.reduce((a, b) => (b.score > a.score ? b : a)) : null
    },
    shame: () => {
      const worstCats = allSamples
        .filter((s) => s.valid && s.pngPath)
        .sort((a, b) => a.score - b.score)
        .slice(0, 8)
      const refusals: Refusal[] = allSamples
        .filter((s) => s.status === 'refusal')
        .map((s) => {
          const rawAbs = join(dir, 'generations', modelDir(s.modelSlug), s.promptId, `sample-${s.sample}.raw.txt`)
          return existsSync(rawAbs)
            ? { modelSlug: s.modelSlug, modelName: s.modelName, promptId: s.promptId, quote: readFileSync(rawAbs, 'utf8').slice(0, 400) }
            : null
        })
        .filter((r): r is Refusal => r !== null)
      // dedupe identical quotes from repeated samples
      const seen = new Set<string>()
      return { worstCats, refusals: refusals.filter((r) => !seen.has(r.quote) && seen.add(r.quote)) }
    },
  }
  if (!process.env.MEOWBENCH_RUN) cached = run
  return run
}
