import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { CannedClient } from '../src/fake-client.js'
import { runGenerate } from '../src/stages/generate.js'
import { runValidate } from '../src/stages/validate.js'
import { runRender } from '../src/stages/render.js'
import { samplePaths } from '../src/run-store.js'
import type { ChatRequest } from '../src/openrouter.js'
import type { ModelSpec, PromptSuite } from '../src/types.js'

const SUITE: PromptSuite = {
  version: 1,
  system: 'Output only SVG markup.',
  prompts: [{ id: 'minimal', title: 'Minimal', user: 'Draw a minimal cat as an SVG.' }],
}
const MODELS: ModelSpec[] = [
  { slug: 'openai/gpt-test', name: 'GPT Test', era: 'current', origin: 'US', license: 'closed' },
  { slug: 'acme/refuser-1', name: 'Refuser', era: 'legacy', origin: 'US', license: 'open' },
]

test('generates samples, writes svg + raw + record, classifies refusals', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  const records = await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: new CannedClient() })
  expect(records).toHaveLength(4) // 2 models x 1 prompt x 2 samples

  const ok = records.filter((r) => r.status === 'ok')
  const refused = records.filter((r) => r.status === 'refusal')
  expect(ok).toHaveLength(2)
  expect(refused).toHaveLength(2)

  const first = ok[0]
  expect(readFileSync(join(runDir, first.svgPath!), 'utf8')).toContain('<svg')
  expect(existsSync(join(runDir, first.rawPath))).toBe(true)
})

test('resumes: existing records are not regenerated', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  let calls = 0
  const counting = {
    chat: async (req: ChatRequest) => {
      calls++
      return new CannedClient().chat(req)
    },
  }
  await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: counting })
  expect(calls).toBe(4)
  await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: counting })
  expect(calls).toBe(4) // no new calls on resume
})

test('resumes: error records ARE retried, terminal records are not', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  let calls = 0
  const flaky = {
    chat: async (req: ChatRequest) => {
      calls++
      if (calls <= 4) throw new Error('ECONNRESET') // first full pass: all 4 samples error
      return new CannedClient().chat(req)
    },
  }
  const first = await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: flaky })
  expect(first.every((r) => r.status === 'error')).toBe(true)
  expect(calls).toBe(4)

  const second = await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: flaky })
  expect(calls).toBe(8) // all 4 error records retried
  expect(second.filter((r) => r.status === 'ok')).toHaveLength(2)
  expect(second.filter((r) => r.status === 'refusal')).toHaveLength(2)

  await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 2, client: flaky })
  expect(calls).toBe(8) // now all terminal — no retries
})

test('validate + render stages produce validation json and pngs for ok samples', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  const records = await runGenerate({ runDir, models: MODELS, suite: SUITE, samples: 1, client: new CannedClient() })
  const validations = runValidate(runDir, records)
  const okKeys = records.filter((r) => r.status === 'ok')
  expect(Object.keys(validations)).toHaveLength(okKeys.length)
  for (const v of Object.values(validations)) expect(v.valid).toBe(true)

  const rendered = runRender(runDir, records, validations)
  expect(rendered).toBe(okKeys.length)
  const p = samplePaths(okKeys[0].modelSlug, okKeys[0].promptId, 1)
  expect(existsSync(join(runDir, p.png))).toBe(true)
})

test('render failure demotes a validated sample to invalid', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'meow-'))
  const records = await runGenerate({ runDir, models: [MODELS[0]], suite: SUITE, samples: 1, client: new CannedClient() })
  const rec = records[0]
  // overwrite the generated svg with a validator-clean but renderer-hostile doc
  writeFileSync(join(runDir, rec.svgPath!), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 100000"><rect width="1" height="100000" fill="black"/></svg>')
  const validations = runValidate(runDir, records)
  expect(validations[`${rec.modelSlug}|${rec.promptId}|${rec.sample}`].valid).toBe(true)
  const rendered = runRender(runDir, records, validations)
  expect(rendered).toBe(0)
  const v = validations[`${rec.modelSlug}|${rec.promptId}|${rec.sample}`]
  expect(v.valid).toBe(false)
  expect(v.reasons).toContain('render-failed')
  // on-disk JSON matches the demotion
  const onDisk = JSON.parse(readFileSync(join(runDir, samplePaths(rec.modelSlug, rec.promptId, rec.sample).validation), 'utf8'))
  expect(onDisk.valid).toBe(false)
})
