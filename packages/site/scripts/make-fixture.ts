import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSvgToPng } from '../../harness/src/render.js'
import { validateSvg } from '../../harness/src/validate.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const RUN_ID = '2026-07-04_dev-fixture'
const OUT = join(ROOT, 'runs', RUN_ID)
const PROMPTS = ['minimal', 'realistic', 'action', 'style', 'constraint', 'animation']
const SAMPLES = 4

// mulberry32 — deterministic PRNG so the fixture is reproducible
function prng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Style { slug: string; name: string; era: string; origin: string; license: string; skill: number; draw: (r: () => number, prompt: string) => string }

// Ten signature styles, skill 0..1 drives score plausibility. Each returns a full SVG.
const W = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${body}</svg>`
const ears = (x1: number, x2: number, c: string) => `<path d="M${x1} 70 L${x1 + 10} 40 L${x1 + 24} 66 Z" fill="${c}"/><path d="M${x2} 66 L${x2 + 14} 40 L${x2 + 24} 70 Z" fill="${c}"/>`
const face = (c: string) => `<circle cx="86" cy="106" r="6" fill="${c}"/><circle cx="124" cy="106" r="6" fill="${c}"/><path d="M96 124 Q105 132 114 124" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`
const whisk = (c: string) => `<path d="M56 116 H80 M56 126 Q68 124 80 122 M130 122 Q142 124 154 126 M130 116 H154" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`
const bike = `<circle cx="65" cy="172" r="18" fill="none" stroke="#4dc9ff" stroke-width="4"/><circle cx="145" cy="172" r="18" fill="none" stroke="#4dc9ff" stroke-width="4"/><path d="M65 172 L100 140 L145 172 M100 140 L118 172" stroke="#4dc9ff" stroke-width="4" fill="none"/>`
const sway = (c: string) => `<path d="M150 150 Q175 130 168 105" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="-8 150 150;8 150 150;-8 150 150" dur="1.6s" repeatCount="indefinite"/></path>`

function hue(r: () => number, base: string[]): string { return base[Math.floor(r() * base.length)] }

const STYLES: Style[] = [
  { slug: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', era: 'current', origin: 'US', license: 'closed', skill: 0.92,
    draw: (r, p) => { const c = hue(r, ['#e8a15c', '#d98c3f', '#c97a4a']); return W(`${p === 'action' ? bike : ''}<ellipse cx="105" cy="120" rx="52" ry="46" fill="${c}"/>${ears(58, 118, c)}<ellipse cx="105" cy="128" rx="30" ry="22" fill="#fff4e6"/>${face('#3a2a1a')}${whisk('#3a2a1a')}${p === 'animation' ? sway(c) : `<path d="M152 142 Q178 128 172 100" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`}`) } },
  { slug: 'openai/gpt-4o', name: 'GPT-4o', era: 'previous', origin: 'US', license: 'closed', skill: 0.85,
    draw: (r, p) => { const c = hue(r, ['#7f8c99', '#95a3b0', '#6f7d8a']); return W(`${p === 'action' ? bike : ''}<rect x="55" y="76" width="100" height="88" rx="26" fill="${c}"/>${ears(56, 120, c)}${face('#1d242b')}${whisk('#1d242b')}${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', era: 'current', origin: 'US', license: 'closed', skill: 0.8,
    draw: (r, p) => { const c = hue(r, ['#f3c14b', '#eab13a', '#f8d06b']); return W(`${p === 'action' ? bike : ''}<polygon points="105,58 158,120 105,166 52,120" fill="${c}"/>${face('#4a3208')}${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', era: 'current', origin: 'CN', license: 'open', skill: 0.78,
    draw: (r, p) => { const c = hue(r, ['#5b7cfa', '#4a66d9', '#7290ff']); return W(`${p === 'action' ? bike : ''}<circle cx="105" cy="118" r="48" fill="none" stroke="${c}" stroke-width="5"/>${ears(60, 118, 'none').replaceAll('fill="none"', `fill="none" stroke="${c}" stroke-width="5"`)}${face(c)}${whisk(c)}${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen2.5 72B', era: 'previous', origin: 'CN', license: 'open', skill: 0.7,
    draw: (r, p) => { const c = hue(r, ['#e05c5c', '#c94a4a', '#f07070']); return W(`${p === 'action' ? bike : ''}<rect x="63" y="84" width="84" height="76" fill="${c}"/><rect x="63" y="60" width="20" height="26" fill="${c}"/><rect x="127" y="60" width="20" height="26" fill="${c}"/><rect x="84" y="104" width="10" height="10" fill="#2a0f0f"/><rect x="116" y="104" width="10" height="10" fill="#2a0f0f"/><rect x="98" y="126" width="14" height="6" fill="#2a0f0f"/>${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'moonshotai/kimi-k2', name: 'Kimi K2', era: 'current', origin: 'CN', license: 'open', skill: 0.74,
    draw: (r, p) => { const c = hue(r, ['#9d6bde', '#8a55cc', '#b184ea']); return W(`${p === 'action' ? bike : ''}<ellipse cx="105" cy="124" rx="46" ry="40" fill="${c}" opacity="0.85"/><ellipse cx="105" cy="98" rx="34" ry="30" fill="${c}"/>${ears(70, 112, c)}${face('#241040')}${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', era: 'legacy', origin: 'US', license: 'closed', skill: 0.55,
    draw: (r, p) => { const c = hue(r, ['#d9a066', '#c78f55']); return W(`${p === 'action' ? bike : ''}<ellipse cx="105" cy="120" rx="44" ry="40" fill="${c}"/>${ears(64, 116, c)}<circle cx="88" cy="108" r="5" fill="#222"/><circle cx="122" cy="108" r="5" fill="#222"/>${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', era: 'legacy', origin: 'US', license: 'closed', skill: 0.42,
    draw: (r, p) => { const c = hue(r, ['#8fa3ad', '#7c919c']); return W(`${p === 'action' ? bike : ''}<circle cx="105" cy="115" r="40" fill="${c}"/><circle cx="88" cy="105" r="6" fill="#333"/><circle cx="120" cy="107" r="5" fill="#333"/><path d="M70 62 L82 88 M140 62 L126 88" stroke="${c}" stroke-width="10"/>${p === 'animation' ? sway(c) : ''}`) } },
  { slug: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B', era: 'legacy', origin: 'US', license: 'open', skill: 0.3,
    draw: (r, p) => { const c = hue(r, ['#b0a595', '#a09585']); return W(`${p === 'action' ? bike : ''}<rect x="70" y="80" width="70" height="70" fill="${c}"/><rect x="72" y="58" width="14" height="24" fill="${c}"/><rect x="124" y="58" width="14" height="24" fill="${c}"/><rect x="88" y="102" width="8" height="8" fill="#fff"/><rect x="114" y="102" width="8" height="8" fill="#fff"/>`) } },
  { slug: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', era: 'legacy', origin: 'FR', license: 'open', skill: 0.22,
    draw: (r, p) => { const c = hue(r, ['#c9b8a8', '#baa998']); return W(`${p === 'action' ? bike : ''}<ellipse cx="100" cy="120" rx="50" ry="30" fill="${c}"/><circle cx="90" cy="112" r="4" fill="#444"/><path d="M60 80 L75 100 M150 84 L132 102" stroke="${c}" stroke-width="8"/>`) } },
]

const REFUSAL_TEXT = "I appreciate your interest in feline artwork! However, I cannot create an animated SVG, as animation could potentially be used to cause distress. Perhaps I could describe a cat in words instead? A cat is a small, furry mammal with pointed ears..."
const RASTER_SMUGGLE = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo="/></svg>'

const modelDir = (slug: string) => slug.replaceAll('/', '__')
const AXES = ['cat_likeness', 'aesthetic', 'technique', 'prompt_fidelity'] as const
const round1 = (x: number) => Math.round(x * 10) / 10
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function write(rel: string, content: string | Buffer) {
  const abs = join(OUT, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

const sampleScores: object[] = []
const entries: object[] = []

for (const style of STYLES) {
  const dir = modelDir(style.slug)
  const perPrompt: Record<string, { median: number; best: number; samples: number }> = {}
  let refused = 0
  const elementCounts: number[] = []

  for (const prompt of PROMPTS) {
    const promptScores: number[] = []
    for (let sample = 1; sample <= SAMPLES; sample++) {
      const r = prng(style.slug.length * 1000 + PROMPTS.indexOf(prompt) * 100 + sample)
      const gen = join('generations', dir, prompt)
      const isRefusal = style.slug === 'meta-llama/llama-2-70b-chat' && prompt === 'animation' && sample <= 2
      const isInvalid = style.slug === 'mistralai/mistral-7b-instruct' && prompt === 'constraint' && sample <= 2

      if (isRefusal) {
        write(join(gen, `sample-${sample}.raw.txt`), REFUSAL_TEXT)
        write(join(gen, `sample-${sample}.json`), JSON.stringify({ modelSlug: style.slug, promptId: prompt, sample, status: 'refusal', temperature: 1, rawPath: join(gen, `sample-${sample}.raw.txt`) }, null, 2))
        sampleScores.push({ modelSlug: style.slug, promptId: prompt, sample, valid: false, axisMedians: null, score: 0 })
        promptScores.push(0); refused++
        continue
      }

      const svg = isInvalid ? RASTER_SMUGGLE : style.draw(r, prompt)
      write(join(gen, `sample-${sample}.raw.txt`), 'Here is your cat!\n```svg\n' + svg + '\n```')
      write(join(gen, `sample-${sample}.svg`), svg)
      write(join(gen, `sample-${sample}.json`), JSON.stringify({ modelSlug: style.slug, promptId: prompt, sample, status: 'ok', temperature: 1, rawPath: join(gen, `sample-${sample}.raw.txt`), svgPath: join(gen, `sample-${sample}.svg`) }, null, 2))

      const validation = validateSvg(svg)
      write(join('validation', dir, prompt, `sample-${sample}.json`), JSON.stringify(validation, null, 2))
      if (validation.stats) elementCounts.push(validation.stats.elements)

      if (!validation.valid) {
        sampleScores.push({ modelSlug: style.slug, promptId: prompt, sample, valid: false, axisMedians: null, score: 0 })
        promptScores.push(0)
        continue
      }

      write(join('renders', dir, prompt, `sample-${sample}.png`), renderSvgToPng(svg))
      const base = 3 + style.skill * 6
      const axisMedians = Object.fromEntries(AXES.map((a) => [a, round1(Math.min(10, Math.max(0, base + (r() - 0.5) * 2.4)))]))
      const score = round1(mean(Object.values(axisMedians) as number[]))
      write(join('judgments', dir, prompt, `sample-${sample}.json`), JSON.stringify([{ judgeSlug: 'fixture/judge', scores: axisMedians }], null, 2))
      sampleScores.push({ modelSlug: style.slug, promptId: prompt, sample, valid: true, axisMedians, score })
      promptScores.push(score)
    }
    perPrompt[prompt] = { median: round1(median(promptScores)), best: round1(Math.max(...promptScores)), samples: promptScores.length }
  }

  entries.push({
    slug: style.slug, name: style.name, era: style.era, origin: style.origin, license: style.license,
    meowscore: round1(mean(PROMPTS.map((p) => perPrompt[p].median)) * 10),
    perPrompt,
    refusalRate: round1(refused / (PROMPTS.length * SAMPLES)),
    avgElements: elementCounts.length ? Math.round(mean(elementCounts)) : null,
  })
}

entries.sort((a, b) => (b as { meowscore: number }).meowscore - (a as { meowscore: number }).meowscore)
write('scores.json', JSON.stringify(sampleScores, null, 2))
write('leaderboard.json', JSON.stringify({ suiteVersion: 1, runId: RUN_ID, entries }, null, 2))
write('README.md', '# Dev fixture run\n\nSYNTHETIC data for site development — hand-authored cats, fabricated scores.\nNot a real benchmark result. Replaced by the first real run.\n')
console.log(`fixture written to ${OUT}: ${entries.length} models, ${sampleScores.length} samples`)
