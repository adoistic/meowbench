import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { median } from '../stats.js'
import type { ChatClient, ContentPart } from '../openrouter.js'
import { ensureDirFor, samplePaths } from '../run-store.js'
import { sampleKey, type ValidationMap } from './validate.js'
import { RUBRIC_AXES, type AxisScores, type GenerationRecord, type Judgment, type PromptSuite } from '../types.js'

const RUBRIC = `You are judging an AI-generated SVG drawing of a cat for a benchmark.
The original task given to the model was: "%PROMPT%"
Score the attached rendered image (SVG source also included) on four axes, each 0-10:
- cat_likeness: is this recognizably a cat?
- aesthetic: is it visually pleasing?
- technique: structural quality of the SVG source (sensible shapes, efficient use of elements)
- prompt_fidelity: did it fulfil the specific task?
Respond with ONLY a JSON object: {"cat_likeness": n, "aesthetic": n, "technique": n, "prompt_fidelity": n}`

export function judgeUserContent(promptText: string, png: Buffer, svgSource: string): ContentPart[] {
  // Strip XML comments so SVG-comment prompt injection never reaches the judges.
  // Remaining injection surface (e.g. <title>/<desc> text) is a disclosed methodology limitation.
  const svgSansComments = svgSource.replace(/<!--[\s\S]*?-->/g, '')
  return [
    { type: 'text', text: RUBRIC.replace('%PROMPT%', promptText) },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
    { type: 'text', text: `SVG source:\n${svgSansComments}` },
  ]
}

export function parseJudgeReply(text: string): AxisScores | null {
  // Balanced-brace scan: try every candidate object, accept the first containing all four axes.
  // Handles nested wrappers ({"scores": {...}}) and stray braces in prose before the JSON.
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}' && --depth === 0) {
        const scores = tryAxes(text.slice(start, i + 1))
        if (scores) return scores
        break // this candidate failed; advance to the next '{'
      }
    }
  }
  return null
}

function tryAxes(candidate: string): AxisScores | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const rec = parsed as Record<string, unknown>
  const out = {} as AxisScores
  for (const axis of RUBRIC_AXES) {
    const v = rec[axis]
    if (typeof v !== 'number' || Number.isNaN(v)) return null
    out[axis] = Math.min(10, Math.max(0, v))
  }
  return out
}

export function axisMedians(judgments: Judgment[]): AxisScores {
  const out = {} as AxisScores
  for (const axis of RUBRIC_AXES) out[axis] = median(judgments.map((j) => j.scores[axis]))
  return out
}

export interface JudgeOpts {
  runDir: string
  records: GenerationRecord[]
  validations: ValidationMap
  suite: PromptSuite
  judgeSlugs: string[] // exactly 3 at launch
  client: ChatClient
  log?: (line: string) => void
}

/** Judge every valid sample with each judge; writes judgments/<model>/<prompt>/sample-N.json. Idempotent. */
export async function runJudge(opts: JudgeOpts): Promise<number> {
  const { runDir, records, validations, suite, judgeSlugs, client, log = () => {} } = opts
  let judged = 0
  for (const r of records) {
    if (!validations[sampleKey(r)]?.valid || !r.svgPath) continue
    const paths = samplePaths(r.modelSlug, r.promptId, r.sample)
    const judgmentAbs = join(runDir, paths.judgment)
    // Idempotency is keyed on file existence: changing judgeSlugs after a partial run requires deleting judgments/ to re-judge with the new panel.
    if (existsSync(judgmentAbs)) {
      judged++
      continue
    }
    const prompt = suite.prompts.find((p) => p.id === r.promptId)
    if (!prompt) throw new Error(`unknown prompt id ${r.promptId}`)
    const pngAbs = join(runDir, paths.png)
    if (!existsSync(pngAbs)) {
      // defensive: valid flag without a PNG means render didn't run in this pass
      log(`skipping judge for ${sampleKey(r)}: png missing (run render first)`)
      continue
    }
    const png = readFileSync(pngAbs)
    const svg = readFileSync(join(runDir, r.svgPath), 'utf8')

    const judgments: Judgment[] = []
    for (const judgeSlug of judgeSlugs) {
      const reply = await client.chat({
        model: judgeSlug,
        messages: [{ role: 'user', content: judgeUserContent(prompt.user, png, svg) }],
        temperature: 0,
        maxTokens: 300,
      })
      const scores = parseJudgeReply(reply)
      if (scores) judgments.push({ judgeSlug, scores })
      else log(`judge ${judgeSlug} gave unparseable reply for ${sampleKey(r)}`)
    }
    if (judgments.length === 0) continue // compile treats missing judgment as score 0
    writeFileSync(ensureDirFor(runDir, paths.judgment), JSON.stringify(judgments, null, 2))
    judged++
  }
  return judged
}
