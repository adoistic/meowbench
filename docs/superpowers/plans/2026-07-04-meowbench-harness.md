# meowbench Harness Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the meowbench eval harness — a TypeScript CLI that generates cat SVGs from ~30 models via OpenRouter, validates, renders, judges, and compiles them into a committed `leaderboard.json`.

**Architecture:** pnpm workspace monorepo. `packages/harness` is a Node CLI with five resumable stages (generate → validate → render → judge → compile); each stage writes files into a `runs/<id>/` folder and skips work already on disk. Pure functions (extract/validate/render/score) are unit-tested; network is behind a `ChatClient` interface with a canned fake for `--dry-run` and tests.

**Tech Stack:** TypeScript (ESM, Node 20+), pnpm workspaces, vitest, commander, fast-xml-parser, @resvg/resvg-js, playwright (animation check only).

**Spec:** `docs/superpowers/specs/2026-07-04-meowbench-design.md`. Plans 2 (vote worker) and 3 (site) will be written after this plan executes.

---

## File structure

```
pnpm-workspace.yaml
package.json                      # root: workspace scripts
tsconfig.base.json
prompts/prompts.json              # versioned 6-prompt suite
models.json                       # launch roster (slugs verified at execution time)
packages/harness/
  package.json                    # @meowbench/harness
  tsconfig.json
  src/
    types.ts                      # all shared interfaces
    stats.ts                      # mean / median / round1
    extract.ts                    # pull <svg>…</svg> out of model chatter
    validate.ts                   # security + structure gate, SVG stats
    render.ts                     # SVG → PNG via resvg
    openrouter.ts                 # ChatClient interface + OpenRouterClient
    fake-client.ts                # CannedClient for tests and --dry-run
    config.ts                     # load prompts.json / models.json
    run-store.ts                  # run-folder paths, sanitized model dirs
    stages/generate.ts
    stages/validate.ts            # loop: validate every generated svg
    stages/render.ts              # loop: render every valid svg
    stages/judge.ts               # 3-judge vision panel
    stages/compile.ts             # scores.json + leaderboard.json
    estimate.ts                   # call-count + rough cost projection
    animate.ts                    # Chromium 3-frame motion check
    cli.ts                        # commander wiring
  test/
    extract.test.ts  validate.test.ts  render.test.ts  stats.test.ts
    openrouter.test.ts  generate.test.ts  judge.test.ts  compile.test.ts
    e2e-dryrun.test.ts  animate.test.ts
```

Each `src` file has one responsibility; stages depend on pure modules, never on each other.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`
- Create: `packages/harness/package.json`, `packages/harness/tsconfig.json`
- Create: `packages/harness/test/smoke.test.ts`

- [ ] **Step 1: Write workspace + package files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
```

Root `package.json`:
```json
{
  "name": "meowbench",
  "private": true,
  "scripts": { "test": "pnpm -r test" },
  "packageManager": "pnpm@9.15.0"
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

`packages/harness/package.json`:
```json
{
  "name": "@meowbench/harness",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "meowbench": "./src/cli.ts" },
  "scripts": { "test": "vitest run", "cli": "tsx src/cli.ts" },
  "dependencies": {
    "@resvg/resvg-js": "^2.6.2",
    "commander": "^12.1.0",
    "fast-xml-parser": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/harness/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

`packages/harness/test/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('harness package boots', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 2: Install and run the smoke test**

Run: `pnpm install && pnpm -F @meowbench/harness test`
Expected: PASS (1 test). If `@resvg/resvg-js` fails to install on this machine, stop and report — Task 5 depends on it.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm monorepo with harness package"
```

---

### Task 2: Types, prompt suite, and model roster

**Files:**
- Create: `packages/harness/src/types.ts`, `packages/harness/src/config.ts`
- Create: `prompts/prompts.json`, `models.json`
- Test: `packages/harness/test/config.test.ts`

- [ ] **Step 1: Write `src/types.ts`** (no test — pure declarations)

```ts
export interface PromptSpec {
  id: string
  title: string
  user: string
}

export interface PromptSuite {
  version: number
  system: string
  prompts: PromptSpec[]
}

export interface ModelSpec {
  slug: string // OpenRouter slug, e.g. "openai/gpt-4o"
  name: string
  era: 'legacy' | 'previous' | 'current'
  origin: string // e.g. "US", "CN", "FR"
  license: 'open' | 'closed'
}

export type SampleStatus = 'ok' | 'refusal' | 'no-svg' | 'error'

export interface GenerationRecord {
  modelSlug: string
  promptId: string
  sample: number // 1-based
  status: SampleStatus
  temperature: number
  rawPath: string // relative to run dir
  svgPath?: string
}

export interface SvgStats {
  bytes: number
  elements: number
  paths: number
  colors: string[]
}

export interface ValidationResult {
  valid: boolean
  reasons: string[]
  stats: SvgStats | null
}

export const RUBRIC_AXES = ['cat_likeness', 'aesthetic', 'technique', 'prompt_fidelity'] as const
export type RubricAxis = (typeof RUBRIC_AXES)[number]
export type AxisScores = Record<RubricAxis, number>

export interface Judgment {
  judgeSlug: string
  scores: AxisScores
}

export interface SampleScore {
  modelSlug: string
  promptId: string
  sample: number
  valid: boolean
  axisMedians: AxisScores | null
  score: number // 0-10; 0 when invalid/refused
}

export interface LeaderboardEntry {
  slug: string
  name: string
  era: ModelSpec['era']
  origin: string
  license: ModelSpec['license']
  meowscore: number // 0-100
  perPrompt: Record<string, { median: number; best: number }>
  refusalRate: number // 0-1 over all samples
  avgElements: number | null
}

export interface Leaderboard {
  suiteVersion: number
  runId: string
  entries: LeaderboardEntry[] // sorted by meowscore desc
}
```

- [ ] **Step 2: Write the failing config test**

`packages/harness/test/config.test.ts`:
```ts
import { expect, test } from 'vitest'
import { loadModels, loadSuite } from '../src/config.js'

test('loads the prompt suite with 6 prompts and a system prompt', () => {
  const suite = loadSuite(new URL('../../../prompts/prompts.json', import.meta.url).pathname)
  expect(suite.version).toBe(1)
  expect(suite.prompts).toHaveLength(6)
  expect(suite.system).toContain('SVG')
  expect(suite.prompts.map((p) => p.id)).toEqual([
    'minimal', 'realistic', 'action', 'style', 'constraint', 'animation',
  ])
})

test('loads models with required fields', () => {
  const models = loadModels(new URL('../../../models.json', import.meta.url).pathname)
  expect(models.length).toBeGreaterThanOrEqual(2)
  for (const m of models) {
    expect(m.slug).toMatch(/^[\w.-]+\/[\w.:-]+$/)
    expect(['legacy', 'previous', 'current']).toContain(m.era)
  }
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/config.test.ts`
Expected: FAIL — cannot find `../src/config.js`

- [ ] **Step 4: Write `prompts/prompts.json`, `models.json`, `src/config.ts`**

`prompts/prompts.json`:
```json
{
  "version": 1,
  "system": "You are an expert SVG artist. Respond with exactly one complete, self-contained SVG document. Output only the SVG markup — no explanations, no markdown fences.",
  "prompts": [
    { "id": "minimal", "title": "Minimal", "user": "Draw a minimal, flat-design cat as an SVG." },
    { "id": "realistic", "title": "Realistic", "user": "Draw a realistic sitting cat with visible fur shading as an SVG." },
    { "id": "action", "title": "Action", "user": "Draw a cat riding a bicycle as an SVG." },
    { "id": "style", "title": "Origami", "user": "Draw an origami-style cat with geometric folds as an SVG." },
    { "id": "constraint", "title": "Constraint", "user": "Draw a recognizable cat as an SVG using at most 12 SVG elements." },
    { "id": "animation", "title": "Animation", "user": "Draw a cat whose tail sways continuously, as an SVG using SMIL or CSS animation only (no JavaScript)." }
  ]
}
```

`models.json` — starter roster. **Executor note: before the first paid run, verify every slug against https://openrouter.ai/models and expand toward the 25–40 target; slugs below are a best-effort starting point and some may have been renamed.**
```json
[
  { "slug": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "era": "legacy", "origin": "US", "license": "closed" },
  { "slug": "openai/gpt-4o", "name": "GPT-4o", "era": "previous", "origin": "US", "license": "closed" },
  { "slug": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku", "era": "legacy", "origin": "US", "license": "closed" },
  { "slug": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4", "era": "current", "origin": "US", "license": "closed" },
  { "slug": "google/gemini-2.5-flash", "name": "Gemini 2.5 Flash", "era": "current", "origin": "US", "license": "closed" },
  { "slug": "deepseek/deepseek-chat-v3-0324", "name": "DeepSeek V3", "era": "current", "origin": "CN", "license": "open" },
  { "slug": "qwen/qwen-2.5-72b-instruct", "name": "Qwen2.5 72B", "era": "previous", "origin": "CN", "license": "open" },
  { "slug": "meta-llama/llama-2-70b-chat", "name": "Llama 2 70B", "era": "legacy", "origin": "US", "license": "open" },
  { "slug": "mistralai/mistral-7b-instruct", "name": "Mistral 7B", "era": "legacy", "origin": "FR", "license": "open" },
  { "slug": "moonshotai/kimi-k2", "name": "Kimi K2", "era": "current", "origin": "CN", "license": "open" }
]
```

`packages/harness/src/config.ts`:
```ts
import { readFileSync } from 'node:fs'
import type { ModelSpec, PromptSuite } from './types.js'

export function loadSuite(path: string): PromptSuite {
  const suite = JSON.parse(readFileSync(path, 'utf8')) as PromptSuite
  if (!suite.version || !suite.system || !Array.isArray(suite.prompts)) {
    throw new Error(`invalid prompt suite: ${path}`)
  }
  return suite
}

export function loadModels(path: string): ModelSpec[] {
  const models = JSON.parse(readFileSync(path, 'utf8')) as ModelSpec[]
  for (const m of models) {
    if (!m.slug || !m.name || !m.era) throw new Error(`invalid model entry: ${JSON.stringify(m)}`)
  }
  return models
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/config.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add core types, prompt suite v1, and starter model roster"
```

---

### Task 3: SVG extraction from model output

**Files:**
- Create: `packages/harness/src/extract.ts`
- Test: `packages/harness/test/extract.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { extractSvg } from '../src/extract.js'

const CAT = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'

test('extracts bare svg', () => {
  expect(extractSvg(CAT)).toBe(CAT)
})

test('extracts svg from markdown fence with prose around it', () => {
  const reply = 'Here is your cat!\n```svg\n' + CAT + '\n```\nEnjoy!'
  expect(extractSvg(reply)).toBe(CAT)
})

test('spans first <svg to last </svg> when nested/multiple', () => {
  const reply = CAT + '\n' + CAT
  const out = extractSvg(reply)
  expect(out?.startsWith('<svg')).toBe(true)
  expect(out?.endsWith('</svg>')).toBe(true)
  expect(out).toContain('\n')
})

test('returns null when no svg present', () => {
  expect(extractSvg('I cannot draw cats, sorry.')).toBeNull()
  expect(extractSvg('</svg> before <svg')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/extract.test.ts`
Expected: FAIL — cannot find `../src/extract.js`

- [ ] **Step 3: Write `src/extract.ts`**

```ts
/** Pull an SVG document out of model output that may include prose or fences. */
export function extractSvg(text: string): string | null {
  const start = text.search(/<svg[\s>]/i)
  if (start === -1) return null
  const end = text.toLowerCase().lastIndexOf('</svg>')
  if (end === -1 || end < start) return null
  return text.slice(start, end + '</svg>'.length)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/extract.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: extract SVG documents from model chatter"
```

---

### Task 4: SVG validator

**Files:**
- Create: `packages/harness/src/validate.ts`
- Test: `packages/harness/test/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { validateSvg } from '../src/validate.js'

const OK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <path d="M0 0 L5 5" fill="#f80" stroke="black"/>
  <circle r="3" fill="#F80"/>
</svg>`

test('accepts a clean svg and reports stats', () => {
  const r = validateSvg(OK)
  expect(r.valid).toBe(true)
  expect(r.reasons).toEqual([])
  expect(r.stats).toMatchObject({ elements: 3, paths: 1 })
  expect(r.stats!.colors).toEqual(['#f80', 'black']) // case-folded, deduped, sorted
})

test('rejects malformed xml', () => {
  const r = validateSvg('<svg><circle</svg>')
  expect(r.valid).toBe(false)
  expect(r.reasons).toContain('not-xml')
})

test('rejects non-svg root', () => {
  expect(validateSvg('<html><svg/></html>').reasons).toContain('root-not-svg')
})

test('rejects embedded raster images', () => {
  const r = validateSvg('<svg><image href="data:image/png;base64,AAAA"/></svg>')
  expect(r.valid).toBe(false)
  expect(r.reasons).toContain('raster-image')
})

test('rejects scripts, event handlers, and external refs', () => {
  expect(validateSvg('<svg><script>alert(1)</script></svg>').reasons).toContain('forbidden-tag:script')
  expect(validateSvg('<svg onload="x()"><rect/></svg>').reasons).toContain('script-attr')
  expect(validateSvg('<svg><use href="https://evil.example/x.svg#a"/></svg>').reasons).toContain('external-ref')
})

test('rejects oversized documents', () => {
  const fat = `<svg>${'<rect/>'.repeat(80_000)}</svg>`
  expect(validateSvg(fat).reasons).toContain('too-large')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/validate.test.ts`
Expected: FAIL — cannot find `../src/validate.js`

- [ ] **Step 3: Write `src/validate.ts`**

```ts
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { ValidationResult } from './types.js'

const MAX_BYTES = 500_000
const FORBIDDEN_TAGS = new Set(['script', 'foreignobject'])

interface Node {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}

function toNodes(parsed: Record<string, unknown>[]): Node[] {
  const nodes: Node[] = []
  for (const item of parsed) {
    const tag = Object.keys(item).find((k) => k !== ':@')
    if (!tag || tag === '#text' || tag === '#comment') continue
    const attrs: Record<string, string> = {}
    for (const [k, v] of Object.entries((item[':@'] as Record<string, unknown>) ?? {})) {
      attrs[k.replace(/^@_/, '').toLowerCase()] = String(v)
    }
    nodes.push({ tag: tag.toLowerCase(), attrs, children: toNodes(item[tag] as Record<string, unknown>[]) })
  }
  return nodes
}

function* walk(nodes: Node[]): Generator<Node> {
  for (const n of nodes) {
    yield n
    yield* walk(n.children)
  }
}

export function validateSvg(svg: string): ValidationResult {
  const bytes = Buffer.byteLength(svg, 'utf8')
  if (bytes > MAX_BYTES) return { valid: false, reasons: ['too-large'], stats: null }
  if (XMLValidator.validate(svg) !== true) return { valid: false, reasons: ['not-xml'], stats: null }

  const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, attributeNamePrefix: '@_' })
  const roots = toNodes(parser.parse(svg) as Record<string, unknown>[])
  const root = roots.find((n) => !n.tag.startsWith('?') && !n.tag.startsWith('!'))
  if (!root || root.tag !== 'svg') return { valid: false, reasons: ['root-not-svg'], stats: null }

  const reasons = new Set<string>()
  const colors = new Set<string>()
  let elements = 0
  let paths = 0

  for (const node of walk([root])) {
    elements++
    if (node.tag === 'path') paths++
    if (FORBIDDEN_TAGS.has(node.tag)) reasons.add(`forbidden-tag:${node.tag}`)
    if (node.tag === 'image') reasons.add('raster-image')
    const href = node.attrs['href'] ?? node.attrs['xlink:href'] ?? ''
    if (/^https?:/i.test(href)) reasons.add('external-ref')
    for (const key of Object.keys(node.attrs)) {
      if (key.startsWith('on')) reasons.add('script-attr')
    }
    for (const key of ['fill', 'stroke'] as const) {
      const v = node.attrs[key]?.toLowerCase()
      if (v && v !== 'none') colors.add(v)
    }
  }

  return {
    valid: reasons.size === 0,
    reasons: [...reasons],
    stats: { bytes, elements, paths, colors: [...colors].sort() },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/validate.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: SVG validation gate with security checks and stats"
```

---

### Task 5: PNG renderer

**Files:**
- Create: `packages/harness/src/render.ts`
- Test: `packages/harness/test/render.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { renderSvgToPng } from '../src/render.js'

const CAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="orange"/></svg>'

test('renders svg to an 800px PNG buffer', () => {
  const png = renderSvgToPng(CAT)
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]) // PNG magic
  expect(png.length).toBeGreaterThan(100)
})

test('throws on unrenderable input', () => {
  expect(() => renderSvgToPng('not svg at all')).toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/render.test.ts`
Expected: FAIL — cannot find `../src/render.js`

- [ ] **Step 3: Write `src/render.ts`**

```ts
import { Resvg } from '@resvg/resvg-js'

/** Deterministic 800px-wide render on white; throws if the SVG cannot render. */
export function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 800 },
    background: 'white',
  })
  return Buffer.from(resvg.render().asPng())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/render.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: deterministic SVG-to-PNG rendering via resvg"
```

---

### Task 6: Stats helpers

**Files:**
- Create: `packages/harness/src/stats.ts`
- Test: `packages/harness/test/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { mean, median, round1 } from '../src/stats.js'

test('median of odd and even counts', () => {
  expect(median([3, 1, 2])).toBe(2)
  expect(median([4, 1, 3, 2])).toBe(2.5)
})

test('mean and round1', () => {
  expect(mean([1, 2, 6])).toBe(3)
  expect(round1(3.14159)).toBe(3.1)
})

test('empty input throws', () => {
  expect(() => median([])).toThrow()
  expect(() => mean([])).toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/stats.test.ts`
Expected: FAIL — cannot find `../src/stats.js`

- [ ] **Step 3: Write `src/stats.ts`**

```ts
export function mean(xs: number[]): number {
  if (xs.length === 0) throw new Error('mean of empty list')
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new Error('median of empty list')
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/stats.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: stats helpers (mean, median, round1)"
```

---

### Task 7: OpenRouter client + canned fake

**Files:**
- Create: `packages/harness/src/openrouter.ts`, `packages/harness/src/fake-client.ts`
- Test: `packages/harness/test/openrouter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test, vi } from 'vitest'
import { OpenRouterClient } from '../src/openrouter.js'

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

test('returns message content on success', async () => {
  const fetchImpl = fetchReturning(200, { choices: [{ message: { content: '<svg/>' } }] })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch)
  const out = await client.chat({ model: 'x/y', messages: [{ role: 'user', content: 'cat' }] })
  expect(out).toBe('<svg/>')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toContain('/chat/completions')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key')
})

test('retries twice on 5xx then succeeds', async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response('boom', { status: 500 }))
    .mockResolvedValueOnce(new Response('boom', { status: 502 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  expect(await client.chat({ model: 'x/y', messages: [] })).toBe('ok')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('does not retry 4xx client errors', async () => {
  const fetchImpl = fetchReturning(400, { error: 'bad' })
  const client = new OpenRouterClient('key', fetchImpl as unknown as typeof fetch, { retryDelayMs: 1 })
  await expect(client.chat({ model: 'x/y', messages: [] })).rejects.toThrow('openrouter 400')
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/openrouter.test.ts`
Expected: FAIL — cannot find `../src/openrouter.js`

- [ ] **Step 3: Write `src/openrouter.ts` and `src/fake-client.ts`**

`src/openrouter.ts`:
```ts
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user'
  content: string | ContentPart[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface ChatClient {
  chat(req: ChatRequest): Promise<string>
}

const MAX_RETRIES = 2

export class OpenRouterClient implements ChatClient {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
    private opts: { baseUrl?: string; retryDelayMs?: number } = {},
  ) {}

  async chat(req: ChatRequest): Promise<string> {
    const url = `${this.opts.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`
    const delay = this.opts.retryDelayMs ?? 500
    let lastError = new Error('unreachable')
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
        return data.choices?.[0]?.message?.content ?? ''
      }
      lastError = new Error(`openrouter ${res.status}`)
      const retryable = res.status >= 500 || res.status === 429
      if (!retryable) throw lastError
      await new Promise((r) => setTimeout(r, delay * 2 ** attempt))
    }
    throw lastError
  }
}
```

`src/fake-client.ts`:
```ts
import type { ChatClient, ChatRequest } from './openrouter.js'

const FAKE_CAT = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 85">` +
  `<ellipse cx="50" cy="48" rx="30" ry="26" fill="${color}"/>` +
  `<path d="M24 32 L30 12 L42 28 Z" fill="${color}"/><path d="M58 28 L70 12 L76 32 Z" fill="${color}"/>` +
  `<circle cx="40" cy="44" r="4" fill="black"/><circle cx="60" cy="44" r="4" fill="black"/></svg>`

/** Deterministic offline client for tests and --dry-run. */
export class CannedClient implements ChatClient {
  async chat(req: ChatRequest): Promise<string> {
    const text = JSON.stringify(req.messages)
    if (text.includes('You are judging')) {
      return '{"cat_likeness": 7, "aesthetic": 6, "technique": 8, "prompt_fidelity": 7}'
    }
    // vary output per model so the dry-run leaderboard is not a tie
    const color = req.model.includes('gpt') ? 'orange' : 'gray'
    if (req.model.includes('refuser')) return 'I cannot draw cats.'
    return `Here you go!\n\`\`\`svg\n${FAKE_CAT(color)}\n\`\`\``
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/openrouter.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: OpenRouter chat client with retries, plus canned offline client"
```

---

### Task 8: Run store + generate stage

**Files:**
- Create: `packages/harness/src/run-store.ts`, `packages/harness/src/stages/generate.ts`
- Test: `packages/harness/test/generate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { CannedClient } from '../src/fake-client.js'
import { runGenerate } from '../src/stages/generate.js'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/generate.test.ts`
Expected: FAIL — cannot find `../src/stages/generate.js`

- [ ] **Step 3: Write `src/run-store.ts` and `src/stages/generate.ts`**

`src/run-store.ts`:
```ts
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** OpenRouter slugs contain '/', which cannot appear in a dirname. */
export function modelDir(slug: string): string {
  return slug.replaceAll('/', '__')
}

export interface SamplePaths {
  dir: string
  raw: string // relative to runDir
  svg: string
  record: string
  validation: string
  png: string
  judgment: string
}

export function samplePaths(modelSlug: string, promptId: string, sample: number): SamplePaths {
  const m = modelDir(modelSlug)
  const gen = join('generations', m, promptId)
  return {
    dir: gen,
    raw: join(gen, `sample-${sample}.raw.txt`),
    svg: join(gen, `sample-${sample}.svg`),
    record: join(gen, `sample-${sample}.json`),
    validation: join('validation', m, promptId, `sample-${sample}.json`),
    png: join('renders', m, promptId, `sample-${sample}.png`),
    judgment: join('judgments', m, promptId, `sample-${sample}.json`),
  }
}

export function ensureDirFor(runDir: string, relPath: string): string {
  const abs = join(runDir, relPath)
  mkdirSync(join(abs, '..'), { recursive: true })
  return abs
}
```

`src/stages/generate.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/generate.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: resumable generate stage with run-folder store"
```

---

### Task 9: Validate + render stages

**Files:**
- Create: `packages/harness/src/stages/validate.ts`, `packages/harness/src/stages/render.ts`
- Test: extend `packages/harness/test/generate.test.ts` (same fixtures)

- [ ] **Step 1: Write the failing test (append to `test/generate.test.ts`)**

```ts
import { runValidate } from '../src/stages/validate.js'
import { runRender } from '../src/stages/render.js'

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
```
(Also add to imports: `import { samplePaths } from '../src/run-store.js'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/generate.test.ts`
Expected: FAIL — cannot find `../src/stages/validate.js`

- [ ] **Step 3: Write the two stage files**

`src/stages/validate.ts`:
```ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureDirFor, samplePaths } from '../run-store.js'
import { validateSvg } from '../validate.js'
import type { GenerationRecord, ValidationResult } from '../types.js'

export type ValidationMap = Record<string, ValidationResult>

export function sampleKey(r: GenerationRecord): string {
  return `${r.modelSlug}|${r.promptId}|${r.sample}`
}

/** Validate every generated SVG; returns map keyed by sampleKey. Idempotent. */
export function runValidate(runDir: string, records: GenerationRecord[]): ValidationMap {
  const out: ValidationMap = {}
  for (const r of records) {
    if (r.status !== 'ok' || !r.svgPath) continue
    const result = validateSvg(readFileSync(join(runDir, r.svgPath), 'utf8'))
    const paths = samplePaths(r.modelSlug, r.promptId, r.sample)
    writeFileSync(ensureDirFor(runDir, paths.validation), JSON.stringify(result, null, 2))
    out[sampleKey(r)] = result
  }
  return out
}
```

`src/stages/render.ts`:
```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSvgToPng } from '../render.js'
import { ensureDirFor, samplePaths } from '../run-store.js'
import { sampleKey, type ValidationMap } from './validate.js'
import type { GenerationRecord } from '../types.js'

/** Render every valid SVG to PNG; returns count rendered. Skips existing PNGs. */
export function runRender(runDir: string, records: GenerationRecord[], validations: ValidationMap): number {
  let rendered = 0
  for (const r of records) {
    const v = validations[sampleKey(r)]
    if (!v?.valid || !r.svgPath) continue
    const paths = samplePaths(r.modelSlug, r.promptId, r.sample)
    const pngAbs = join(runDir, paths.png)
    if (existsSync(pngAbs)) {
      rendered++
      continue
    }
    try {
      const png = renderSvgToPng(readFileSync(join(runDir, r.svgPath), 'utf8'))
      writeFileSync(ensureDirFor(runDir, paths.png), png)
      rendered++
    } catch {
      // render failure ⇒ mark invalid so judge/compile treat it as a zero
      v.valid = false
      v.reasons.push('render-failed')
      writeFileSync(ensureDirFor(runDir, paths.validation), JSON.stringify(v, null, 2))
    }
  }
  return rendered
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/generate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: validate and render stages over run folders"
```

---

### Task 10: Judge stage

**Files:**
- Create: `packages/harness/src/stages/judge.ts`
- Test: `packages/harness/test/judge.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { axisMedians, judgeUserContent, parseJudgeReply } from '../src/stages/judge.js'

test('parseJudgeReply reads clean and messy JSON, clamps to 0-10', () => {
  expect(parseJudgeReply('{"cat_likeness":7,"aesthetic":6,"technique":8,"prompt_fidelity":7}')).toEqual({
    cat_likeness: 7, aesthetic: 6, technique: 8, prompt_fidelity: 7,
  })
  const messy = 'Sure! Here are my scores:\n{"cat_likeness": 15, "aesthetic": -2, "technique": 8.5, "prompt_fidelity": 7}\nHope that helps.'
  expect(parseJudgeReply(messy)).toEqual({ cat_likeness: 10, aesthetic: 0, technique: 8.5, prompt_fidelity: 7 })
  expect(parseJudgeReply('I refuse to judge cats.')).toBeNull()
  expect(parseJudgeReply('{"cat_likeness": 5}')).toBeNull() // missing axes
})

test('axisMedians takes per-axis median across judges', () => {
  const medians = axisMedians([
    { judgeSlug: 'a', scores: { cat_likeness: 4, aesthetic: 5, technique: 6, prompt_fidelity: 7 } },
    { judgeSlug: 'b', scores: { cat_likeness: 8, aesthetic: 5, technique: 2, prompt_fidelity: 9 } },
    { judgeSlug: 'c', scores: { cat_likeness: 6, aesthetic: 8, technique: 4, prompt_fidelity: 8 } },
  ])
  expect(medians).toEqual({ cat_likeness: 6, aesthetic: 5, technique: 4, prompt_fidelity: 8 })
})

test('judge content includes rubric, prompt text, png, and svg source', () => {
  const parts = judgeUserContent('Draw a cat riding a bicycle as an SVG.', Buffer.from('PNGDATA'), '<svg/>')
  const text = parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('\n')
  expect(text).toContain('You are judging')
  expect(text).toContain('cat riding a bicycle')
  expect(text).toContain('<svg/>')
  const img = parts.find((p) => p.type === 'image_url') as { image_url: { url: string } }
  expect(img.image_url.url).toMatch(/^data:image\/png;base64,/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/judge.test.ts`
Expected: FAIL — cannot find `../src/stages/judge.js`

- [ ] **Step 3: Write `src/stages/judge.ts`**

```ts
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
  return [
    { type: 'text', text: RUBRIC.replace('%PROMPT%', promptText) },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
    { type: 'text', text: `SVG source:\n${svgSource}` },
  ]
}

export function parseJudgeReply(text: string): AxisScores | null {
  const match = text.match(/\{[\s\S]*?\}/)
  if (!match) return null
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
  const out = {} as AxisScores
  for (const axis of RUBRIC_AXES) {
    const v = parsed[axis]
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
    if (existsSync(judgmentAbs)) {
      judged++
      continue
    }
    const prompt = suite.prompts.find((p) => p.id === r.promptId)
    if (!prompt) throw new Error(`unknown prompt id ${r.promptId}`)
    const png = readFileSync(join(runDir, paths.png))
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/judge.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: vision judge panel stage with rubric and median aggregation"
```

---

### Task 11: Compile stage

**Files:**
- Create: `packages/harness/src/stages/compile.ts`
- Test: `packages/harness/test/compile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
  expect(leaderboard.entries[0].perPrompt['minimal']).toEqual({ median: 7, best: 7 })
  expect(sampleScores.filter((s) => s.modelSlug === 'acme/refuser-1').every((s) => s.score === 0)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/compile.test.ts`
Expected: FAIL — cannot find `../src/stages/compile.js`

- [ ] **Step 3: Write `src/stages/compile.ts`**

```ts
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
        ? { median: round1(median(scores)), best: round1(Math.max(...scores)) }
        : { median: 0, best: 0 }
    }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meowbench/harness test test/compile.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: compile stage producing scores.json and leaderboard.json"
```

---

### Task 12: CLI, estimate, and dry-run end-to-end

**Files:**
- Create: `packages/harness/src/estimate.ts`, `packages/harness/src/cli.ts`
- Test: `packages/harness/test/e2e-dryrun.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    modelsPath: new URL('../../../models.json', import.meta.url).pathname,
    promptsPath: new URL('../../../prompts/prompts.json', import.meta.url).pathname,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meowbench/harness test test/e2e-dryrun.test.ts`
Expected: FAIL — cannot find `../src/estimate.js`

- [ ] **Step 3: Write `src/estimate.ts` and `src/cli.ts`**

`src/estimate.ts`:
```ts
export interface EstimateOpts {
  modelCount: number
  promptCount: number
  samples: number
  judgeCount: number
}

// Display-only assumptions, documented on the methodology page:
// ~2k tokens per generation at ~$5/M avg, ~1.5k tokens per judge call at ~$3/M avg.
const GEN_USD = 0.01
const JUDGE_USD = 0.005

export function estimateRun(o: EstimateOpts) {
  const generations = o.modelCount * o.promptCount * o.samples
  const maxJudgeCalls = generations * o.judgeCount
  return {
    generations,
    maxJudgeCalls,
    roughUsd: Math.round((generations * GEN_USD + maxJudgeCalls * JUDGE_USD) * 100) / 100,
  }
}
```

`src/cli.ts`:
```ts
import { Command } from 'commander'
import { basename } from 'node:path'
import { loadModels, loadSuite } from './config.js'
import { estimateRun } from './estimate.js'
import { CannedClient } from './fake-client.js'
import { OpenRouterClient, type ChatClient } from './openrouter.js'
import { compileRun } from './stages/compile.js'
import { runGenerate } from './stages/generate.js'
import { runJudge } from './stages/judge.js'
import { runRender } from './stages/render.js'
import { runValidate } from './stages/validate.js'

export interface RunAllOpts {
  runDir: string
  modelsPath: string
  promptsPath: string
  samples: number
  judgeSlugs: string[]
  dryRun: boolean
  apiKey?: string
  log?: (line: string) => void
}

export async function runAll(opts: RunAllOpts): Promise<void> {
  const { runDir, samples, judgeSlugs, log = console.log } = opts
  const models = loadModels(opts.modelsPath)
  const suite = loadSuite(opts.promptsPath)

  let client: ChatClient
  if (opts.dryRun) {
    client = new CannedClient()
  } else {
    const key = opts.apiKey ?? process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY is not set (or pass --dry-run)')
    client = new OpenRouterClient(key)
  }

  const records = await runGenerate({ runDir, models, suite, samples, client, log })
  const validations = runValidate(runDir, records)
  const rendered = runRender(runDir, records, validations)
  log(`rendered ${rendered} pngs`)
  const judged = await runJudge({ runDir, records, validations, suite, judgeSlugs, client, log })
  log(`judged ${judged} samples`)
  const { leaderboard } = compileRun({ runDir, records, validations, suite, models, runId: basename(runDir) })
  log(`leaderboard: ${leaderboard.entries.map((e) => `${e.name}=${e.meowscore}`).join('  ')}`)
}

const program = new Command()
program.name('meowbench').description('Which AI draws the best cat as an SVG?')

program
  .command('run')
  .requiredOption('--run-dir <dir>', 'run folder, e.g. runs/2026-07-04_run-001')
  .option('--models <path>', 'models.json', 'models.json')
  .option('--prompts <path>', 'prompts json', 'prompts/prompts.json')
  .option('--samples <n>', 'samples per model x prompt', '4')
  .option('--judges <slugs>', 'comma-separated judge slugs', '')
  .option('--dry-run', 'offline canned client', false)
  .option('--estimate', 'print projected calls/cost and exit', false)
  .action(async (o: Record<string, string | boolean>) => {
    const models = loadModels(String(o.models))
    const suite = loadSuite(String(o.prompts))
    const judgeSlugs = String(o.judges).split(',').filter(Boolean)
    const samples = Number(o.samples)
    if (o.estimate) {
      const est = estimateRun({
        modelCount: models.length, promptCount: suite.prompts.length,
        samples, judgeCount: judgeSlugs.length || 3,
      })
      console.log(`generations: ${est.generations}\nmax judge calls: ${est.maxJudgeCalls}\nrough cost: ~$${est.roughUsd}`)
      return
    }
    if (!o.dryRun && judgeSlugs.length !== 3) throw new Error('exactly 3 --judges required for a real run')
    await runAll({
      runDir: String(o.runDir), modelsPath: String(o.models), promptsPath: String(o.prompts),
      samples, judgeSlugs: judgeSlugs.length ? judgeSlugs : ['judge/a', 'judge/b', 'judge/c'],
      dryRun: Boolean(o.dryRun),
    })
  })

// Only parse argv when executed directly, not when imported by tests.
if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('meowbench')) {
  program.parseAsync().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run tests to verify they pass, plus the real CLI dry-run**

Run: `pnpm -F @meowbench/harness test`
Expected: ALL tests pass (whole suite)

Run: `pnpm -F @meowbench/harness cli run --run-dir /tmp/meow-cli-test --dry-run --samples 2`
Expected: log lines ending with a `leaderboard:` line; `/tmp/meow-cli-test/leaderboard.json` exists

Run: `pnpm -F @meowbench/harness cli run --run-dir /tmp/x --estimate`
Expected: prints generations / max judge calls / rough cost, exits without network

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: meowbench CLI with dry-run pipeline and cost estimate"
```

---

### Task 13: Animation motion check

**Files:**
- Create: `packages/harness/src/animate.ts`
- Test: `packages/harness/test/animate.test.ts`
- Modify: `packages/harness/package.json` (add `playwright` to devDependencies — it is only needed when running the animation check)

- [ ] **Step 1: Add dependency**

Run: `pnpm -F @meowbench/harness add -D playwright && pnpm -F @meowbench/harness exec playwright install chromium`

- [ ] **Step 2: Write the test (gated — Chromium runs are slow)**

```ts
import { expect, test } from 'vitest'
import { checkMotion } from '../src/animate.js'

const gated = process.env.MEOWBENCH_CHROMIUM ? test : test.skip

const WAGGING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="45" y="20" width="10" height="60" fill="black">
    <animateTransform attributeName="transform" type="rotate" from="-20 50 80" to="20 50 80"
      dur="0.4s" repeatCount="indefinite"/>
  </rect></svg>`

const STATIC = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50"/></svg>'

gated('detects SMIL motion', async () => {
  expect(await checkMotion(WAGGING)).toBe(true)
}, 30_000)

gated('static svg has no motion', async () => {
  expect(await checkMotion(STATIC)).toBe(false)
}, 30_000)
```

- [ ] **Step 3: Run to verify it fails (with the gate on)**

Run: `MEOWBENCH_CHROMIUM=1 pnpm -F @meowbench/harness test test/animate.test.ts`
Expected: FAIL — cannot find `../src/animate.js`

- [ ] **Step 4: Write `src/animate.ts`**

```ts
import { chromium } from 'playwright'

/** Render the SVG in Chromium, screenshot at 0/500/1000ms; motion = any frame differs. */
export async function checkMotion(svg: string): Promise<boolean> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
    await page.setContent(`<body style="margin:0">${svg}</body>`)
    const frames: Buffer[] = []
    for (let i = 0; i < 3; i++) {
      frames.push(await page.screenshot())
      if (i < 2) await page.waitForTimeout(500)
    }
    return !frames[0].equals(frames[1]) || !frames[1].equals(frames[2])
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `MEOWBENCH_CHROMIUM=1 pnpm -F @meowbench/harness test test/animate.test.ts`
Expected: PASS (2 tests). Also run `pnpm -F @meowbench/harness test` (ungated) — animate tests SKIP, everything else PASSES.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Chromium motion check for the animation prompt"
```

---

## Done criteria for this plan

- `pnpm test` green from the repo root (animation tests gated behind `MEOWBENCH_CHROMIUM=1`).
- `pnpm -F @meowbench/harness cli run --run-dir /tmp/demo --dry-run` produces a complete offline run folder with a plausible `leaderboard.json`.
- `--estimate` prints call counts and rough cost without touching the network.
- No real API spend happened during implementation.

**Follow-ups (separate plans):** Plan 2 — vote worker (D1 schema, Elo, rate limiting); Plan 3 — Astro arcade site consuming `runs/*/leaderboard.json`. Wiring `checkMotion` into the compile stage's `prompt_fidelity` context and integrating the animation flag into the leaderboard is deliberately deferred to Plan 3, when the site defines how it displays the "animates" badge.
