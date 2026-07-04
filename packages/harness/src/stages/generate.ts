import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractSvg } from '../extract.js'
import type { ChatClient } from '../openrouter.js'
import { ensureDirFor, samplePaths } from '../run-store.js'
import type { GenerationRecord, ModelSpec, PromptSuite, SampleStatus } from '../types.js'

const TEMPERATURE = 1.0
const REFUSAL_RE = /\b(cannot|can't|unable|won't|sorry)\b/i

export interface GenerateOpts {
  runDir: string
  models: ModelSpec[]
  suite: PromptSuite
  samples?: number
  client: ChatClient
  log?: (line: string) => void
}

export async function runGenerate(opts: GenerateOpts): Promise<GenerationRecord[]> {
  const { runDir, models, suite, client, log = () => {} } = opts
  const samples = opts.samples ?? 4
  const records: GenerationRecord[] = []

  for (const model of models) {
    for (const prompt of suite.prompts) {
      for (let sample = 1; sample <= samples; sample++) {
        const paths = samplePaths(model.slug, prompt.id, sample)
        const recordAbs = join(runDir, paths.record)
        if (existsSync(recordAbs)) {
          records.push(JSON.parse(readFileSync(recordAbs, 'utf8')) as GenerationRecord)
          continue
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
            maxTokens: 8192,
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
        records.push(record)
        log(`${model.slug} ${prompt.id} #${sample}: ${status}`)
      }
    }
  }
  return records
}
