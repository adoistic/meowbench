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
  svgUrl: string | null // public URL to the actual .svg — what the UI displays (crisp, animated)
  pngPath: string | null // rasterized judge input; not displayed, kept for reference
  svgSource: string | null
  status: string
}
export interface Refusal { modelSlug: string; modelName: string; promptId: string; quote: string }
export interface Failure { modelSlug: string; modelName: string; promptId: string; sample: number; reasons: string[] }

export interface RunData {
  runId: string
  suiteVersion: number
  entries: Entry[]
  prompts: PromptSpec[]
  allSamples: Sample[]
  samplesFor(slug: string): Sample[]
  bestCatFor(slug: string): Sample | null
  shame(): { worstCats: Sample[]; refusals: Refusal[]; failures: Failure[] }
}

// Directory names we will never auto-select. This is the guardrail: the site
// shows real benchmark data or it fails the build — it does not quietly fall
// back to synthetic "demo" cats. An explicit MEOWBENCH_RUN can still point at
// anything on purpose, but nothing placeholder wins by default.
const PLACEHOLDER = /fixture|demo|placeholder|synthetic|mock|sample/i

export function resolveRunId(): string {
  if (process.env.MEOWBENCH_RUN) return process.env.MEOWBENCH_RUN
  const withBoard = readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RUNS, d.name, 'leaderboard.json')))
    .map((d) => d.name)
  // Invariant: run directory names sort lexically in chronological order
  // (YYYY-MM-DD prefix), so the newest real run is the last one after sorting.
  const real = withBoard.filter((n) => !PLACEHOLDER.test(n)).sort()
  if (real.length) return real[real.length - 1]
  throw new Error(
    withBoard.length
      ? `runs/ contains only placeholder data (${withBoard.join(', ')}). The site refuses to build on synthetic cats — commit a real benchmark run, or set MEOWBENCH_RUN to select one deliberately.`
      : 'no benchmark run with a leaderboard.json found under runs/ — commit a real run before building the site.',
  )
}

let cached: RunData | null = null

export function loadRun(): RunData {
  if (cached && !process.env.MEOWBENCH_RUN) return cached
  const runId = resolveRunId()
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
      svgUrl: existsSync(svgAbs) ? `/run/svg/${md}/${s.promptId}/sample-${s.sample}.svg` : null,
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
      const valid = allSamples.filter((s) => s.modelSlug === slug && s.valid && s.svgUrl)
      return valid.length ? valid.reduce((a, b) => (b.score > a.score ? b : a)) : null
    },
    shame: () => {
      const worstCats = allSamples
        .filter((s) => s.valid && s.svgUrl)
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
      // Samples that didn't survive validation — the modern failure mode. No
      // model refuses anymore; they just occasionally ship SVGs that won't
      // render, aren't valid XML, or smuggle in a <script>. The reason comes
      // from the validation record, never from model output.
      const failures: Failure[] = allSamples
        .filter((s) => !s.valid)
        .map((s) => {
          const vAbs = join(dir, 'validation', modelDir(s.modelSlug), s.promptId, `sample-${s.sample}.json`)
          const reasons = existsSync(vAbs)
            ? ((JSON.parse(readFileSync(vAbs, 'utf8')) as { reasons?: string[] }).reasons ?? [])
            : []
          return { modelSlug: s.modelSlug, modelName: s.modelName, promptId: s.promptId, sample: s.sample, reasons }
        })
        .sort((a, b) => a.modelName.localeCompare(b.modelName) || a.promptId.localeCompare(b.promptId))
      return { worstCats, refusals: refusals.filter((r) => !seen.has(r.quote) && seen.add(r.quote)), failures }
    },
  }
  if (!process.env.MEOWBENCH_RUN) cached = run
  return run
}
