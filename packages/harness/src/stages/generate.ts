import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractSvg } from '../extract.js'
import type { ChatClient } from '../openrouter.js'
import { mapPool } from '../pool.js'
import { ensureDirFor, samplePaths } from '../run-store.js'
import type { GenerationRecord, ModelSpec, PromptSpec, PromptSuite, SampleStatus } from '../types.js'

const TEMPERATURE = 1.0
// English-only heuristic: non-English refusals fall through to 'no-svg' (same score, different diagnostic bucket — v1 limitation).
const REFUSAL_RE = /\b(cannot|can't|unable|won't|sorry)\b/i

export interface GenerateOpts {
  runDir: string
  models: ModelSpec[]
  suite: PromptSuite
  samples?: number
  client: ChatClient
  /** Max in-flight generations. Default 1 (sequential). Higher parallelizes across
   *  model×prompt×sample so one slow/hung model can't block the rest. */
  concurrency?: number
  log?: (line: string) => void
}

interface GenTask { model: ModelSpec; prompt: PromptSpec; sample: number }

export async function runGenerate(opts: GenerateOpts): Promise<GenerationRecord[]> {
  const { runDir, models, suite, client, log = () => {} } = opts
  const samples = opts.samples ?? 4
  const concurrency = opts.concurrency ?? 1

  const tasks: GenTask[] = []
  for (const model of models)
    for (const prompt of suite.prompts)
      for (let sample = 1; sample <= samples; sample++) tasks.push({ model, prompt, sample })

  return mapPool(tasks, concurrency, async ({ model, prompt, sample }): Promise<GenerationRecord> => {
    const paths = samplePaths(model.slug, prompt.id, sample)
    const recordAbs = join(runDir, paths.record)
    if (existsSync(recordAbs)) {
      const prior = JSON.parse(readFileSync(recordAbs, 'utf8')) as GenerationRecord
      // terminal statuses are kept; transient errors fall through and are retried
      if (prior.status !== 'error') return prior
    }

    let status: SampleStatus
    let raw = ''
    let svg: string | null = null
    try {
      raw = await client.chat({
        model: model.slug,
        messages: [
          { role: 'system', content: suite.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: TEMPERATURE,
      })
      svg = extractSvg(raw)
      status = svg ? 'ok' : REFUSAL_RE.test(raw) ? 'refusal' : 'no-svg'
    } catch (err) {
      raw = String(err)
      status = 'error'
    }

    writeFileSync(ensureDirFor(runDir, paths.raw), raw)
    if (svg) writeFileSync(ensureDirFor(runDir, paths.svg), svg)

    const record: GenerationRecord = {
      modelSlug: model.slug,
      promptId: prompt.id,
      sample,
      status,
      temperature: TEMPERATURE,
      rawPath: paths.raw,
      ...(svg ? { svgPath: paths.svg } : {}),
    }
    writeFileSync(ensureDirFor(runDir, paths.record), JSON.stringify(record, null, 2))
    log(`${model.slug} ${prompt.id} #${sample}: ${status}`)
    return record
  })
}
