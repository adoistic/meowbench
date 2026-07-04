# meowbench Arcade Site Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the meowbench public website — an arcade-cabinet-styled Astro site that renders the leaderboard, gallery, voting arena, Hall of Shame, methodology, and per-model pages from a committed benchmark run.

**Architecture:** New workspace package `packages/site`, Astro 5 static output for Cloudflare Pages. A build-time data layer (`src/lib/run-data.ts`) reads the latest `runs/<id>/` folder (leaderboard.json, scores.json, raw SVGs, refusal texts); a prebuild script syncs rendered PNGs into `public/run/`. Every page except the Arena works with JavaScript disabled (`<details>` leaderboard rows, `:target` lightboxes). Two small client scripts: the Arena voting flow and the live Crowd Score column, both talking to the vote worker with graceful offline degradation. Since no real benchmark run exists yet, Task 2 generates a committed, clearly-labeled synthetic dev fixture with visually diverse cats.

**Tech Stack:** Astro ^5 (static), vanilla CSS design system (custom properties, no Tailwind), @fontsource/bungee + @fontsource/silkscreen + @fontsource/rubik, Shiki via `astro:components` Code for SVG source display, vitest for the data layer, tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-07-04-meowbench-design.md` ("Website" section). Depends on plans 1 & 2 (both merged). Vote worker API: `POST /api/vote` `{winnerId, loserId, promptId}` (ids are `modelSlug|promptId|sample`), `GET /api/standings` → `{standings: [{model, rating, games, wins, losses}]}`.

---

## Design direction (locked — every task's code serves this)

**Concept: a 1982 arcade cabinet that has become sentient and extremely fond of cats.** The machine takes the benchmark deadly seriously; the subject is cats. All wit is deadpan machine-voice ("INSERT CAT TO CONTINUE", "9 LIVES REMAINING", "GAME OVER" on refusals).

- **Palette** (CSS vars, defined once in Task 1): void `#120a26`, panel `#1d1240`, panel-edge `#2c1e5c`, neon yellow `#ffde59`, hot pink `#ff3d81`, mint `#8affc1`, cyan `#4dc9ff`, soft text `#cfc4f2`, dim text `#8d7fc0`. Dominant dark purple; neon used sharply, never as gradients on white.
- **Type:** Bungee (marquee headlines, nav logo), Silkscreen (scores, ranks, labels, stat readouts — the "machine voice"), Rubik (body prose, methodology).
- **Atmosphere:** full-page CRT scanline overlay + corner vignette; hero panel with animated marquee chase-lights border; subtle pixel-grid background on panels. All motion behind `prefers-reduced-motion` guards.
- **Signature moments:** the leaderboard IS an arcade high-score table (RANK / MODEL / MEOWSCORE / CROWD, top-3 rows glow gold/silver/bronze); the Arena is "CAT FIGHT" with a blinking "CHOOSE YOUR FIGHTER" prompt; Hall of Shame entries are "GAME OVER" cards with the refusal quoted on a CRT terminal screen.
- **Never:** Inter/system fonts, purple-gradient-on-white, generic card grids with identical border-radius everywhere, lorem ipsum. Microcopy is written, not placeholder.

## Data contracts (from the merged backend — do not drift)

- `runs/<id>/leaderboard.json`: `{suiteVersion, runId, entries: [{slug, name, era, origin, license, meowscore, perPrompt: {[promptId]: {median, best, samples}}, refusalRate, avgElements}]}` sorted by meowscore desc.
- `runs/<id>/scores.json`: `[{modelSlug, promptId, sample, valid, axisMedians: {cat_likeness, aesthetic, technique, prompt_fidelity} | null, score}]`.
- Assets: `runs/<id>/renders/<modelDir>/<promptId>/sample-N.png` and `runs/<id>/generations/<modelDir>/<promptId>/sample-N.svg` + `sample-N.raw.txt` + `sample-N.json` (GenerationRecord with `status`), where `modelDir = slug.replaceAll('/', '__')`.
- Vote ids: `modelSlug|promptId|sample` (raw slug with `/`, not modelDir).
- Prompts: `prompts/prompts.json` `{version, system, prompts: [{id, title, user}]}` — ids: minimal, realistic, action, style, constraint, animation.

## File structure

```
packages/site/
├── package.json                  # @meowbench/site
├── tsconfig.json
├── astro.config.mjs
├── vitest.config.ts
├── scripts/
│   ├── make-fixture.ts           # generates runs/2026-07-04_dev-fixture (Task 2)
│   └── sync-assets.ts            # copies latest run's PNGs → public/run/ (Task 4)
├── src/
│   ├── styles/arcade.css         # the design system (tokens, scanlines, neon, marquee)
│   ├── lib/run-data.ts           # build-time loader: latest run, entries, samples, refusals
│   ├── lib/slug.ts               # modelDir + sampleId helpers (mirror backend conventions)
│   ├── layouts/Base.astro        # head, fonts, nav, footer, scanlines
│   ├── components/
│   │   ├── LeaderboardTable.astro
│   │   ├── PromptBars.astro      # per-prompt median bars
│   │   ├── CatCard.astro         # PNG card + :target lightbox (PNG, Shiki SVG source, scores)
│   │   └── CrowdScore.astro      # live Elo column (client fetch, graceful "—")
│   └── pages/
│       ├── index.astro           # hero + leaderboard
│       ├── gallery.astro         # all cats grouped by prompt
│       ├── arena.astro           # CAT FIGHT (client script)
│       ├── shame.astro           # Hall of Shame
│       ├── methodology.astro
│       └── models/[dir].astro    # per-model pages (dir = modelDir)
├── src/scripts/arena.ts          # client: pairing, vote POST, reveal
└── test/
    ├── slug.test.ts
    ├── run-data.test.ts
    └── build-output.test.ts      # post-build assertions on dist/ HTML
runs/2026-07-04_dev-fixture/      # committed synthetic run (Task 2) + README
```

---

### Task 1: Scaffold the site package + the arcade design system

**Files:**
- Create: `packages/site/package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`
- Create: `packages/site/src/styles/arcade.css`, `src/layouts/Base.astro`, `src/pages/index.astro` (placeholder), `test/smoke.test.ts`

- [ ] **Step 1: Write config files**

`packages/site/package.json`:
```json
{
  "name": "@meowbench/site",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "prebuild": "tsx scripts/sync-assets.ts",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource/bungee": "^5.1.0",
    "@fontsource/rubik": "^5.1.0",
    "@fontsource/silkscreen": "^5.1.0",
    "astro": "^5.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

(Note: `prebuild` references `scripts/sync-assets.ts` which arrives in Task 4. Until then create a stub `packages/site/scripts/sync-assets.ts` containing `// asset sync arrives in Task 4` so `pnpm build` doesn't fail. Report the stub.)

`packages/site/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "scripts"]
}
```

`packages/site/astro.config.mjs`:
```js
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  site: 'https://meowbench.pages.dev',
})
```

`packages/site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
```

`packages/site/test/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('site package boots', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 2: Write `src/styles/arcade.css`** — the whole design system. Complete file:

```css
/* meowbench arcade design system.
   Concept: a 1982 arcade cabinet that has become sentient and extremely fond of cats. */

:root {
  --void: #120a26;
  --panel: #1d1240;
  --panel-edge: #2c1e5c;
  --ink: #cfc4f2;
  --ink-dim: #8d7fc0;
  --yellow: #ffde59;
  --pink: #ff3d81;
  --mint: #8affc1;
  --cyan: #4dc9ff;
  --gold: #ffd700;
  --silver: #c0cbdc;
  --bronze: #d29a6b;
  --font-marquee: 'Bungee', cursive;
  --font-pixel: 'Silkscreen', monospace;
  --font-body: 'Rubik', sans-serif;
  --glow-yellow: 0 0 6px rgba(255, 222, 89, 0.9), 0 0 24px rgba(255, 222, 89, 0.35);
  --glow-pink: 0 0 6px rgba(255, 61, 129, 0.9), 0 0 24px rgba(255, 61, 129, 0.35);
  --glow-mint: 0 0 6px rgba(138, 255, 193, 0.8), 0 0 20px rgba(138, 255, 193, 0.3);
}

* { box-sizing: border-box; }

html {
  background: var(--void);
  color: var(--ink);
  font-family: var(--font-body);
  line-height: 1.65;
  scrollbar-color: var(--panel-edge) var(--void);
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(ellipse 120% 90% at 50% -20%, #241456 0%, transparent 60%),
    var(--void);
}

/* CRT scanlines + vignette over everything, under nothing interactive */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 999;
  background:
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.14) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse 130% 130% at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.45) 100%);
}

main { max-width: 68rem; margin: 0 auto; padding: 0 1.25rem 5rem; }

h1, h2 { font-family: var(--font-marquee); font-weight: 400; line-height: 1.1; }
h1 { font-size: clamp(2rem, 6vw, 3.6rem); color: var(--yellow); text-shadow: var(--glow-yellow); margin: 0; }
h2 { font-size: clamp(1.3rem, 3.5vw, 1.9rem); color: var(--pink); text-shadow: var(--glow-pink); }

a { color: var(--cyan); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--mint); }

.pixel { font-family: var(--font-pixel); letter-spacing: 0.02em; }
.dim { color: var(--ink-dim); }

/* Panels — the cabinet bezels */
.panel {
  background: var(--panel);
  border: 2px solid var(--panel-edge);
  border-radius: 10px;
  padding: 1.4rem;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 8px 8px;
}

/* Marquee chase-lights: dotted border that "chases" via background-position steps */
.marquee {
  position: relative;
  padding: 2.2rem 1.6rem;
  border-radius: 14px;
  background: var(--panel);
  overflow: hidden;
}
.marquee::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  padding: 6px;
  background:
    repeating-linear-gradient(90deg, var(--yellow) 0 6px, transparent 6px 18px) top / 100% 6px no-repeat,
    repeating-linear-gradient(90deg, var(--yellow) 0 6px, transparent 6px 18px) bottom / 100% 6px no-repeat,
    repeating-linear-gradient(0deg, var(--yellow) 0 6px, transparent 6px 18px) left / 6px 100% no-repeat,
    repeating-linear-gradient(0deg, var(--yellow) 0 6px, transparent 6px 18px) right / 6px 100% no-repeat;
  animation: chase 0.9s steps(3) infinite;
  opacity: 0.85;
  pointer-events: none;
}
@keyframes chase {
  to { background-position: 18px top, -18px bottom, left -18px, right 18px; }
}

/* Blinking "insert coin" text */
.blink { animation: blink 1.1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .marquee::before { animation: none; }
  .blink { animation: none; }
  * { transition: none !important; }
}

/* Buttons — chunky cabinet buttons */
.btn {
  display: inline-block;
  font-family: var(--font-pixel);
  font-size: 1rem;
  color: var(--void);
  background: var(--pink);
  border: 0;
  border-radius: 8px;
  padding: 0.7rem 1.5rem;
  cursor: pointer;
  text-decoration: none;
  box-shadow: 0 5px 0 #a3164e, var(--glow-pink);
  transition: transform 0.06s, box-shadow 0.06s;
}
.btn:hover { color: var(--void); transform: translateY(2px); box-shadow: 0 3px 0 #a3164e, var(--glow-pink); }
.btn:active { transform: translateY(5px); box-shadow: 0 0 0 #a3164e; }
.btn--mint { background: var(--mint); box-shadow: 0 5px 0 #3aa87a, var(--glow-mint); }
.btn--mint:hover { box-shadow: 0 3px 0 #3aa87a, var(--glow-mint); }

/* High-score leaderboard rows */
.scoreboard { list-style: none; margin: 0; padding: 0; }
.scoreboard > li + li { margin-top: 0.6rem; }
.score-row summary {
  display: grid;
  grid-template-columns: 3.2rem 1fr 7rem 6rem;
  gap: 0.8rem;
  align-items: baseline;
  padding: 0.85rem 1.1rem;
  background: var(--panel);
  border: 2px solid var(--panel-edge);
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-pixel);
  font-size: 1.02rem;
  list-style: none;
}
.score-row summary::-webkit-details-marker { display: none; }
.score-row summary:hover { border-color: var(--cyan); }
.score-row[open] summary { border-radius: 10px 10px 0 0; border-bottom-color: transparent; }
.score-row .rank { color: var(--ink-dim); }
.score-row .meow { color: var(--yellow); text-align: right; }
.score-row .crowd { color: var(--cyan); text-align: right; }
.score-row.top-1 summary { border-color: var(--gold); box-shadow: 0 0 14px rgba(255, 215, 0, 0.25); }
.score-row.top-1 .rank { color: var(--gold); }
.score-row.top-2 summary { border-color: var(--silver); }
.score-row.top-2 .rank { color: var(--silver); }
.score-row.top-3 summary { border-color: var(--bronze); }
.score-row.top-3 .rank { color: var(--bronze); }
.score-row .row-detail {
  border: 2px solid var(--panel-edge);
  border-top: 0;
  border-radius: 0 0 10px 10px;
  padding: 1.1rem;
  background: #170e33;
}

/* Stat bars (per-prompt medians) */
.bar { display: grid; grid-template-columns: 7.5rem 1fr 2.6rem; gap: 0.6rem; align-items: center; font-family: var(--font-pixel); font-size: 0.8rem; }
.bar + .bar { margin-top: 0.45rem; }
.bar .track { height: 10px; background: #0d0721; border-radius: 5px; overflow: hidden; }
.bar .fill { height: 100%; background: linear-gradient(90deg, var(--cyan), var(--mint)); border-radius: 5px; }
.bar .val { color: var(--mint); text-align: right; }

/* Cat cards */
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1rem; }
.cat-card { display: block; background: var(--panel); border: 2px solid var(--panel-edge); border-radius: 10px; padding: 0.6rem; text-decoration: none; transition: transform 0.1s, border-color 0.1s; }
.cat-card:hover { transform: translateY(-3px) rotate(-0.5deg); border-color: var(--yellow); }
.cat-card img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #fff; border-radius: 6px; image-rendering: auto; display: block; }
.cat-card .label { font-family: var(--font-pixel); font-size: 0.72rem; color: var(--ink-dim); margin-top: 0.5rem; display: flex; justify-content: space-between; }
.cat-card .label .score { color: var(--yellow); }

/* :target lightbox — no JS required */
.lightbox { position: fixed; inset: 0; display: none; z-index: 1000; background: rgba(10, 5, 24, 0.92); overflow-y: auto; padding: 3rem 1rem; }
.lightbox:target { display: block; }
.lightbox .frame { max-width: 56rem; margin: 0 auto; }
.lightbox img { width: min(100%, 480px); background: #fff; border-radius: 8px; display: block; margin: 0 auto; }
.lightbox .close { position: fixed; top: 1rem; right: 1.4rem; font-family: var(--font-pixel); font-size: 1.4rem; color: var(--pink); text-decoration: none; text-shadow: var(--glow-pink); }
.lightbox pre { max-height: 40vh; overflow: auto; border-radius: 8px; padding: 1rem !important; font-size: 0.8rem; }

/* GAME OVER cards (Hall of Shame) */
.gameover { border: 2px solid var(--pink); border-radius: 10px; background: #1a0b22; padding: 1.2rem; }
.gameover .go-title { font-family: var(--font-marquee); color: var(--pink); text-shadow: var(--glow-pink); font-size: 1.2rem; }
.gameover blockquote { font-family: var(--font-pixel); font-size: 0.85rem; color: var(--mint); background: #06110c; border: 1px solid #1d4030; border-radius: 6px; padding: 0.9rem; margin: 0.8rem 0 0; }
.gameover blockquote::before { content: '> '; color: var(--ink-dim); }

/* Nav + footer */
.site-nav { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1.4rem; padding: 1.2rem 1.25rem; max-width: 68rem; margin: 0 auto; }
.site-nav .logo { font-family: var(--font-marquee); font-size: 1.5rem; color: var(--yellow); text-shadow: var(--glow-yellow); text-decoration: none; }
.site-nav a:not(.logo) { font-family: var(--font-pixel); font-size: 0.85rem; color: var(--ink); text-decoration: none; }
.site-nav a:not(.logo):hover { color: var(--mint); }
.site-nav a[aria-current='page'] { color: var(--pink); }
.site-footer { max-width: 68rem; margin: 4rem auto 0; padding: 1.5rem 1.25rem 2.5rem; border-top: 2px dashed var(--panel-edge); font-family: var(--font-pixel); font-size: 0.75rem; color: var(--ink-dim); display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }

@media (max-width: 640px) {
  .score-row summary { grid-template-columns: 2.2rem 1fr 4.5rem; font-size: 0.85rem; }
  .score-row .crowd { display: none; }
}
```

- [ ] **Step 3: Write `src/layouts/Base.astro`**

```astro
---
import '@fontsource/bungee'
import '@fontsource/silkscreen'
import '@fontsource/rubik'
import '@fontsource/rubik/500.css'
import '../styles/arcade.css'

interface Props {
  title: string
  description?: string
  current?: string
}
const { title, description = 'Which AI draws the best cat as an SVG? An unreasonably rigorous benchmark.', current = '' } = Astro.props
const nav = [
  ['/', 'leaderboard'],
  ['/gallery/', 'gallery'],
  ['/arena/', 'arena'],
  ['/shame/', 'hall of shame'],
  ['/methodology/', 'methodology'],
]
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title} · meowbench</title>
  </head>
  <body>
    <nav class="site-nav">
      <a class="logo" href="/">meowbench</a>
      {nav.map(([href, label]) => (
        <a href={href} aria-current={current === href ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
    <main>
      <slot />
    </main>
    <footer class="site-footer">
      <span>© 2026 meowbench · no cats were harmed. several were poorly drawn.</span>
      <span><a href="https://github.com/adoistic/meowbench">source</a> · <span class="blink">INSERT CAT TO CONTINUE</span></span>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: Placeholder `src/pages/index.astro`** (replaced in Task 5)

```astro
---
import Base from '../layouts/Base.astro'
---
<Base title="Leaderboard" current="/">
  <h1>WHICH AI DRAWS THE BEST CAT?</h1>
  <p class="pixel dim">machine is warming up…</p>
</Base>
```

Also create the stub `packages/site/scripts/sync-assets.ts`:
```ts
// asset sync arrives in Task 4
```

- [ ] **Step 5: Install, test, build**

Run: `pnpm install && pnpm -F @meowbench/site test`
Expected: PASS (1 test)

Run: `pnpm -F @meowbench/site build`
Expected: builds `packages/site/dist/index.html` without errors. Open `dist/index.html` content and confirm it contains "WHICH AI DRAWS THE BEST CAT?".

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold arcade site package with design system and base layout"
```

---

### Task 2: Committed dev-fixture run (synthetic, visually diverse)

The site needs data; no real benchmark run exists yet (real runs cost money and are gated on issue #2). This task generates and COMMITS `runs/2026-07-04_dev-fixture/` — a synthetic run with 10 models × 6 prompts × 4 samples of programmatically varied hand-authored cats (each model gets a signature drawing style), realistic scores, two comedy refusals, and one invalid SVG, so every site feature has real data to render. Clearly labeled synthetic.

**Files:**
- Create: `packages/site/scripts/make-fixture.ts`
- Create: `packages/site/test/fixture.test.ts`
- Generated + committed: `runs/2026-07-04_dev-fixture/**` and `runs/2026-07-04_dev-fixture/README.md`

- [ ] **Step 1: Write the failing test**

`packages/site/test/fixture.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const FIXTURE = fileURLToPath(new URL('../../../runs/2026-07-04_dev-fixture', import.meta.url))

test('fixture run has a complete leaderboard and assets', () => {
  expect(existsSync(join(FIXTURE, 'leaderboard.json'))).toBe(true)
  const lb = JSON.parse(readFileSync(join(FIXTURE, 'leaderboard.json'), 'utf8'))
  expect(lb.entries.length).toBe(10)
  expect(lb.runId).toBe('2026-07-04_dev-fixture')
  // sorted desc, scores varied (not a flat tie)
  const scores = lb.entries.map((e: { meowscore: number }) => e.meowscore)
  expect([...scores].sort((a: number, b: number) => b - a)).toEqual(scores)
  expect(new Set(scores).size).toBeGreaterThan(5)

  const top = lb.entries[0]
  const dir = top.slug.replaceAll('/', '__')
  expect(existsSync(join(FIXTURE, 'renders', dir, 'minimal', 'sample-1.png'))).toBe(true)
  expect(existsSync(join(FIXTURE, 'generations', dir, 'minimal', 'sample-1.svg'))).toBe(true)
})

test('fixture includes refusals with raw text and an invalid sample', () => {
  const scores = JSON.parse(readFileSync(join(FIXTURE, 'scores.json'), 'utf8'))
  const invalid = scores.filter((s: { valid: boolean }) => !s.valid)
  expect(invalid.length).toBeGreaterThanOrEqual(2)
  // at least one refusal record exists with quotable raw text
  const recPath = join(FIXTURE, 'generations', 'meta-llama__llama-2-70b-chat', 'animation', 'sample-1.json')
  expect(existsSync(recPath)).toBe(true)
  const rec = JSON.parse(readFileSync(recPath, 'utf8'))
  expect(rec.status).toBe('refusal')
  const raw = readFileSync(join(FIXTURE, 'generations', 'meta-llama__llama-2-70b-chat', 'animation', 'sample-1.raw.txt'), 'utf8')
  expect(raw.length).toBeGreaterThan(20)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @meowbench/site test test/fixture.test.ts`
Expected: FAIL — fixture dir doesn't exist.

- [ ] **Step 3: Write `scripts/make-fixture.ts`**

Complete generator. It hand-authors 10 signature cat styles as SVG template functions, varies them per prompt and per sample (seeded PRNG — deterministic output), renders PNGs via the harness's `renderSvgToPng` (deep import, executed with tsx), writes GenerationRecords/scores/leaderboard matching the backend contracts exactly, and plants two refusals (`meta-llama/llama-2-70b-chat` on `animation` samples 1-2, with a quotable refusal text) and two invalid samples (`mistralai/mistral-7b-instruct` `constraint` samples 1-2: raster-smuggling SVG that fails validation).

```ts
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
```

- [ ] **Step 4: Generate the fixture and verify**

Run: `pnpm -F @meowbench/site exec tsx scripts/make-fixture.ts`
Expected: prints `fixture written to … 10 models, 240 samples`.

Run: `pnpm -F @meowbench/site test test/fixture.test.ts`
Expected: PASS (2 tests). Also spot-open 2-3 PNGs (e.g. `runs/2026-07-04_dev-fixture/renders/anthropic__claude-sonnet-4/action/sample-1.png`) with the Read tool to confirm they render as visible cats (Claude on a bicycle should show an orange cat above two cyan wheels).

- [ ] **Step 5: Commit** (fixture is committed by design — it's the site's dev data)

```bash
git add -A && git commit -m "feat: committed synthetic dev-fixture run with ten signature cat styles"
```

---

### Task 3: Data layer — slug helpers + run loader

**Files:**
- Create: `packages/site/src/lib/slug.ts`, `packages/site/src/lib/run-data.ts`
- Test: `packages/site/test/slug.test.ts`, `packages/site/test/run-data.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/site/test/slug.test.ts`:
```ts
import { expect, test } from 'vitest'
import { modelDir, sampleId } from '../src/lib/slug.js'

test('modelDir mirrors the harness convention', () => {
  expect(modelDir('openai/gpt-4o')).toBe('openai__gpt-4o')
})

test('sampleId mirrors the vote-worker convention', () => {
  expect(sampleId('openai/gpt-4o', 'action', 3)).toBe('openai/gpt-4o|action|3')
})
```

`packages/site/test/run-data.test.ts`:
```ts
import { expect, test } from 'vitest'
import { loadRun } from '../src/lib/run-data.js'

test('loads the latest run (dev fixture) with entries, prompts, and samples', () => {
  const run = loadRun()
  expect(run.runId).toBe('2026-07-04_dev-fixture')
  expect(run.entries).toHaveLength(10)
  expect(run.prompts.map((p) => p.id)).toContain('minimal')
  // samples are joined with their scores and asset paths
  const top = run.entries[0]
  const s = run.samplesFor(top.slug)
  expect(s.length).toBe(24)
  const valid = s.find((x) => x.valid)!
  expect(valid.pngPath).toMatch(/^\/run\/renders\//)
  expect(valid.svgSource).toContain('<svg')
  expect(valid.id).toBe(`${top.slug}|${valid.promptId}|${valid.sample}`)
})

test('bestCatFor returns the highest-scoring valid sample', () => {
  const run = loadRun()
  const best = run.bestCatFor(run.entries[0].slug)!
  expect(best.valid).toBe(true)
  for (const s of run.samplesFor(run.entries[0].slug)) {
    if (s.valid) expect(best.score).toBeGreaterThanOrEqual(s.score)
  }
})

test('shame returns lowest valid cats and quotable refusals', () => {
  const run = loadRun()
  const { worstCats, refusals } = run.shame()
  expect(worstCats.length).toBeGreaterThanOrEqual(6)
  for (let i = 1; i < worstCats.length; i++) expect(worstCats[i].score).toBeGreaterThanOrEqual(worstCats[i - 1].score)
  expect(refusals.length).toBeGreaterThanOrEqual(1)
  expect(refusals[0].quote.length).toBeGreaterThan(20)
  expect(refusals[0].modelName).toBe('Llama 2 70B')
})

test('MEOWBENCH_RUN env overrides run selection', () => {
  process.env.MEOWBENCH_RUN = '2026-07-04_dev-fixture'
  expect(loadRun().runId).toBe('2026-07-04_dev-fixture')
  delete process.env.MEOWBENCH_RUN
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @meowbench/site test test/slug.test.ts test/run-data.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write the modules**

`packages/site/src/lib/slug.ts`:
```ts
/** Mirror of the harness run-store convention: '/' cannot appear in dirnames. */
export function modelDir(slug: string): string {
  return slug.replaceAll('/', '__')
}

/** Mirror of the vote-worker sample-id convention. */
export function sampleId(slug: string, promptId: string, sample: number): string {
  return `${slug}|${promptId}|${sample}`
}
```

`packages/site/src/lib/run-data.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm -F @meowbench/site test`
Expected: ALL pass (smoke 1 + fixture 2 + slug 2 + run-data 4 = 9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: build-time run data layer (latest-run selection, samples, shame)"
```

---

### Task 4: Asset sync (renders → public/) wired into the build

**Files:**
- Replace: `packages/site/scripts/sync-assets.ts` (the Task 1 stub)
- Test: `packages/site/test/sync-assets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { syncAssets } from '../scripts/sync-assets.js'

const SITE = fileURLToPath(new URL('..', import.meta.url))

test('syncAssets copies the latest run renders into public/run and is idempotent', () => {
  rmSync(join(SITE, 'public', 'run'), { recursive: true, force: true })
  const n1 = syncAssets()
  expect(n1).toBeGreaterThan(200) // 240 samples minus refusals/invalid
  expect(existsSync(join(SITE, 'public', 'run', 'renders', 'anthropic__claude-sonnet-4', 'minimal', 'sample-1.png'))).toBe(true)
  const n2 = syncAssets()
  expect(n2).toBe(n1) // idempotent count, re-copy is fine
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @meowbench/site test test/sync-assets.test.ts`
Expected: FAIL — syncAssets not exported (stub).

- [ ] **Step 3: Write `scripts/sync-assets.ts`**

```ts
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = fileURLToPath(new URL('..', import.meta.url))
const ROOT = join(SITE, '..', '..')
const RUNS = join(ROOT, 'runs')

function latestRunId(): string {
  if (process.env.MEOWBENCH_RUN) return process.env.MEOWBENCH_RUN
  const dirs = readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RUNS, d.name, 'leaderboard.json')))
    .map((d) => d.name)
    .sort()
  if (!dirs.length) throw new Error('no runs found')
  return dirs[dirs.length - 1]
}

/** Copy the latest run's renders into public/run/. Returns the PNG count. */
export function syncAssets(): number {
  const runId = latestRunId()
  const src = join(RUNS, runId, 'renders')
  const dest = join(SITE, 'public', 'run', 'renders')
  rmSync(join(SITE, 'public', 'run'), { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  let count = 0
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name))
      else if (e.name.endsWith('.png')) count++
    }
  }
  walk(dest)
  console.log(`synced ${count} renders from ${runId}`)
  return count
}

if (process.argv[1]?.endsWith('sync-assets.ts')) syncAssets()
```

Also add `packages/site/public/.gitignore` containing `run/` (synced assets are build artifacts, not committed).

- [ ] **Step 4: Run tests + full build**

Run: `pnpm -F @meowbench/site test` — all pass (10 tests).
Run: `pnpm -F @meowbench/site build` — prebuild syncs assets, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sync latest run renders into site public assets at build time"
```

---

### Task 5: Home page — hero + high-score leaderboard (the flagship)

**Files:**
- Replace: `packages/site/src/pages/index.astro`
- Create: `packages/site/src/components/LeaderboardTable.astro`, `src/components/PromptBars.astro`
- Test: `packages/site/test/build-output.test.ts`

- [ ] **Step 1: Write the failing build-output test**

```ts
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'

const SITE = fileURLToPath(new URL('..', import.meta.url))
let html = ''

beforeAll(() => {
  execSync('pnpm build', { cwd: SITE, stdio: 'inherit' })
  html = readFileSync(join(SITE, 'dist', 'index.html'), 'utf8')
}, 240_000)

test('home page renders the full leaderboard', () => {
  expect(html).toContain('WHICH AI DRAWS THE BEST CAT?')
  expect(html).toContain('Claude Sonnet 4') // fixture top entry
  expect((html.match(/score-row/g) ?? []).length).toBeGreaterThanOrEqual(10)
})

test('rows carry per-prompt bars and best-cat images without JS', () => {
  expect(html).toContain('class="bar"')
  expect(html).toContain('/run/renders/')
  expect(html).toContain('<details') // expandable rows are native details
})
```

(Vitest note: give this file its own long timeout as shown; it runs a real `astro build`.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -F @meowbench/site test test/build-output.test.ts`
Expected: FAIL — placeholder page has no score rows.

- [ ] **Step 3: Write the components**

`packages/site/src/components/PromptBars.astro`:
```astro
---
import type { Entry, PromptSpec } from '../lib/run-data'
interface Props { entry: Entry; prompts: PromptSpec[] }
const { entry, prompts } = Astro.props
---
<div>
  {prompts.map((p) => {
    const pp = entry.perPrompt[p.id]
    return (
      <div class="bar">
        <span class="dim">{p.id}</span>
        <div class="track"><div class="fill" style={`width: ${(pp?.median ?? 0) * 10}%`}></div></div>
        <span class="val">{(pp?.median ?? 0).toFixed(1)}</span>
      </div>
    )
  })}
</div>
```

`packages/site/src/components/LeaderboardTable.astro`:
```astro
---
import type { RunData } from '../lib/run-data'
import { modelDir } from '../lib/slug'
import PromptBars from './PromptBars.astro'
interface Props { run: RunData }
const { run } = Astro.props
---
<ol class="scoreboard">
  {run.entries.map((entry, i) => {
    const best = run.bestCatFor(entry.slug)
    return (
      <li>
        <details class={`score-row ${i < 3 ? `top-${i + 1}` : ''}`}>
          <summary>
            <span class="rank">{String(i + 1).padStart(2, '0')}</span>
            <span>{entry.name}</span>
            <span class="meow">{entry.meowscore.toFixed(1)}</span>
            <span class="crowd" data-crowd={entry.slug}>—</span>
          </summary>
          <div class="row-detail">
            <div style="display: grid; grid-template-columns: 180px 1fr; gap: 1.2rem; align-items: start;">
              {best && best.pngPath ? (
                <a class="cat-card" href={`/models/${modelDir(entry.slug)}/`}>
                  <img src={best.pngPath} alt={`Best cat by ${entry.name}`} loading="lazy" width="360" height="360" />
                  <span class="label"><span>best cat</span><span class="score">{best.score.toFixed(1)}</span></span>
                </a>
              ) : (
                <div class="gameover"><span class="go-title">NO CAT</span><p class="pixel dim" style="margin:0.5rem 0 0">every attempt was rejected</p></div>
              )}
              <div>
                <PromptBars entry={entry} prompts={run.prompts} />
                <p class="pixel dim" style="margin: 0.9rem 0 0; font-size: 0.75rem;">
                  refusal rate {(entry.refusalRate * 100).toFixed(0)}%
                  {entry.avgElements !== null && <> · avg {entry.avgElements} elements</>}
                  · {entry.era} · {entry.origin} · {entry.license}
                  · <a href={`/models/${modelDir(entry.slug)}/`}>all 24 attempts →</a>
                </p>
              </div>
            </div>
          </div>
        </details>
      </li>
    )
  })}
</ol>
<style>
  @media (max-width: 640px) {
    .row-detail > div { grid-template-columns: 1fr !important; }
  }
</style>
```

`packages/site/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro'
import LeaderboardTable from '../components/LeaderboardTable.astro'
import CrowdScore from '../components/CrowdScore.astro'
import { loadRun } from '../lib/run-data'
const run = loadRun()
const isFixture = run.runId.includes('fixture')
---
<Base title="Leaderboard" current="/">
  <section class="marquee" style="text-align: center; margin-top: 1rem;">
    <h1>WHICH AI DRAWS<br />THE BEST CAT?</h1>
    <p class="pixel" style="color: var(--mint); margin: 1rem 0 0.4rem;">
      an unreasonably rigorous investigation
    </p>
    <p class="pixel dim" style="font-size: 0.8rem; margin: 0;">
      {run.entries.length} models · 6 prompts · 4 attempts each · 3 vision judges · zero mercy
    </p>
    <p style="margin: 1.4rem 0 0;">
      <a class="btn" href="/arena/">VOTE IN THE ARENA</a>
    </p>
  </section>

  {isFixture && (
    <p class="pixel" style="text-align:center; color: var(--pink); font-size: 0.8rem; margin-top: 1rem;">
      ⚠ DEMO MODE — synthetic dev data. real benchmark run coming soon.
    </p>
  )}

  <h2 style="margin-top: 3rem;">HIGH SCORES</h2>
  <p class="pixel dim" style="font-size: 0.8rem; margin-top: -0.6rem;">
    meowscore = judge panel 0–100 · crowd = your votes (elo) · click a row for the evidence
  </p>
  <LeaderboardTable run={run} />
  <CrowdScore />
</Base>
```

(`CrowdScore.astro` arrives in Task 8; for THIS task create it as a minimal no-op component so the page builds:)
```astro
---
// Live crowd-score column — wired to the vote worker in Task 8.
---
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm -F @meowbench/site test test/build-output.test.ts`
Expected: PASS (2 tests). Then `pnpm -F @meowbench/site test` — all green.

Also run `pnpm -F @meowbench/site dev` briefly and Read a screenshot is not possible headlessly here — instead verify visually via the built HTML structure (row count, images referenced). Visual QA happens at the final review with `astro preview`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: arcade home page with marquee hero and high-score leaderboard"
```

---

### Task 6: Cat cards, lightboxes, and per-model pages

**Files:**
- Create: `packages/site/src/components/CatCard.astro`, `src/pages/models/[dir].astro`
- Modify: `packages/site/test/build-output.test.ts` (append tests)

- [ ] **Step 1: Append failing tests to `test/build-output.test.ts`**

```ts
test('model pages exist with all samples and lightboxes', () => {
  const model = readFileSync(join(SITE, 'dist', 'models', 'anthropic__claude-sonnet-4', 'index.html'), 'utf8')
  expect(model).toContain('Claude Sonnet 4')
  expect((model.match(/class="cat-card"/g) ?? []).length).toBeGreaterThanOrEqual(20)
  expect(model).toContain('class="lightbox"') // :target lightbox, no JS
  expect(model).toContain('&lt;svg') // escaped/highlighted SVG source present
})
```

- [ ] **Step 2: Run to verify failure** — model pages don't exist yet.

- [ ] **Step 3: Write the component and page**

`packages/site/src/components/CatCard.astro`:
```astro
---
import { Code } from 'astro:components'
import type { Sample } from '../lib/run-data'
interface Props { sample: Sample; anchor: string }
const { sample, anchor } = Astro.props
const axes = sample.axisMedians ?? {}
---
{sample.pngPath ? (
  <>
    <a class="cat-card" href={`#${anchor}`}>
      <img src={sample.pngPath} alt={`${sample.modelName} — ${sample.promptId} attempt ${sample.sample}`} loading="lazy" width="360" height="360" />
      <span class="label"><span>{sample.promptId} #{sample.sample}</span><span class="score">{sample.score.toFixed(1)}</span></span>
    </a>
    <div class="lightbox" id={anchor}>
      <a class="close" href="#!" aria-label="close">✕ CLOSE</a>
      <div class="frame">
        <img src={sample.pngPath} alt="" />
        <div class="panel" style="margin-top: 1rem;">
          <p class="pixel" style="margin: 0 0 0.6rem; color: var(--yellow);">
            {sample.modelName} · {sample.promptId} · attempt {sample.sample} · score {sample.score.toFixed(1)}
          </p>
          <div style="display: flex; gap: 1.2rem; flex-wrap: wrap;" class="pixel dim">
            {Object.entries(axes).map(([k, v]) => <span>{k.replace('_', ' ')}: <span style="color: var(--mint)">{Number(v).toFixed(1)}</span></span>)}
          </div>
        </div>
        {sample.svgSource && (
          <div style="margin-top: 1rem;">
            <p class="pixel dim" style="font-size: 0.75rem;">the actual svg, as the machine wrote it:</p>
            <Code code={sample.svgSource} lang="xml" theme="synthwave-84" />
          </div>
        )}
      </div>
    </div>
  </>
) : (
  <div class="gameover">
    <span class="go-title">GAME OVER</span>
    <p class="pixel dim" style="margin: 0.4rem 0 0; font-size: 0.75rem;">{sample.promptId} #{sample.sample} · {sample.status === 'refusal' ? 'refused to draw' : 'invalid svg'}</p>
  </div>
)}
```

`packages/site/src/pages/models/[dir].astro`:
```astro
---
import Base from '../../layouts/Base.astro'
import CatCard from '../../components/CatCard.astro'
import { loadRun } from '../../lib/run-data'
import { modelDir } from '../../lib/slug'

export function getStaticPaths() {
  const run = loadRun()
  return run.entries.map((entry) => ({ params: { dir: modelDir(entry.slug) }, props: { slug: entry.slug } }))
}

const { slug } = Astro.props
const run = loadRun()
const entry = run.entries.find((e) => e.slug === slug)!
const rank = run.entries.indexOf(entry) + 1
const samples = run.samplesFor(slug)
const byPrompt = run.prompts.map((p) => ({ prompt: p, samples: samples.filter((s) => s.promptId === p.id) }))
---
<Base title={entry.name} current="">
  <p class="pixel dim" style="margin-top: 1.5rem;"><a href="/">← high scores</a></p>
  <h1 style="font-size: clamp(1.6rem, 4.5vw, 2.6rem);">{entry.name}</h1>
  <p class="pixel" style="color: var(--mint);">
    RANK {String(rank).padStart(2, '0')} · MEOWSCORE {entry.meowscore.toFixed(1)} · {entry.era} · {entry.origin} · {entry.license}
  </p>
  {byPrompt.map(({ prompt, samples }) => (
    <section>
      <h2 style="font-size: 1.15rem; margin-top: 2.2rem;">{prompt.id}</h2>
      <p class="dim" style="margin-top: -0.5rem; font-size: 0.9rem;">“{prompt.user}”</p>
      <div class="cat-grid">
        {samples.map((s) => <CatCard sample={s} anchor={`cat-${modelDir(s.modelSlug)}-${s.promptId}-${s.sample}`} />)}
      </div>
    </section>
  ))}
</Base>
```

- [ ] **Step 4: Run to verify pass** — `pnpm -F @meowbench/site test` all green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: per-model pages with cat cards and no-JS target lightboxes"
```

---

### Task 7: Gallery + Hall of Shame

**Files:**
- Create: `packages/site/src/pages/gallery.astro`, `src/pages/shame.astro`
- Modify: `packages/site/test/build-output.test.ts` (append)

- [ ] **Step 1: Append failing tests**

```ts
test('gallery groups every valid cat by prompt', () => {
  const gallery = readFileSync(join(SITE, 'dist', 'gallery', 'index.html'), 'utf8')
  for (const p of ['minimal', 'realistic', 'action', 'style', 'constraint', 'animation']) {
    expect(gallery).toContain(`id="${p}"`)
  }
  expect((gallery.match(/class="cat-card"/g) ?? []).length).toBeGreaterThanOrEqual(200)
})

test('hall of shame shows game-over cards and refusal quotes', () => {
  const shame = readFileSync(join(SITE, 'dist', 'shame', 'index.html'), 'utf8')
  expect(shame).toContain('GAME OVER')
  expect(shame).toContain('cannot create an animated SVG') // fixture refusal quote
})
```

- [ ] **Step 2: Run to verify failure** — pages don't exist.

- [ ] **Step 3: Write the pages**

`packages/site/src/pages/gallery.astro`:
```astro
---
import Base from '../layouts/Base.astro'
import CatCard from '../components/CatCard.astro'
import { loadRun } from '../lib/run-data'
import { modelDir } from '../lib/slug'
const run = loadRun()
const byPrompt = run.prompts.map((p) => ({
  prompt: p,
  samples: run.allSamples.filter((s) => s.promptId === p.id && s.valid && s.pngPath).sort((a, b) => b.score - a.score),
}))
---
<Base title="Gallery" current="/gallery/">
  <h1 style="margin-top: 1.5rem;">THE GALLERY</h1>
  <p class="pixel dim">every cat, every attempt. sorted by score. judge for yourself — literally, in the <a href="/arena/">arena</a>.</p>
  <nav class="pixel" style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem;">
    {run.prompts.map((p) => <a href={`#${p.id}`}>{p.id}</a>)}
  </nav>
  {byPrompt.map(({ prompt, samples }) => (
    <section id={prompt.id} style="scroll-margin-top: 1rem;">
      <h2 style="margin-top: 2.4rem;">{prompt.id}</h2>
      <p class="dim" style="margin-top: -0.5rem;">“{prompt.user}” · {samples.length} survivors</p>
      <div class="cat-grid">
        {samples.map((s) => <CatCard sample={s} anchor={`g-${modelDir(s.modelSlug)}-${s.promptId}-${s.sample}`} />)}
      </div>
    </section>
  ))}
</Base>
```

`packages/site/src/pages/shame.astro`:
```astro
---
import Base from '../layouts/Base.astro'
import CatCard from '../components/CatCard.astro'
import { loadRun } from '../lib/run-data'
import { modelDir } from '../lib/slug'
const run = loadRun()
const { worstCats, refusals } = run.shame()
---
<Base title="Hall of Shame" current="/shame/">
  <h1 style="margin-top: 1.5rem; color: var(--pink); text-shadow: var(--glow-pink);">HALL OF SHAME</h1>
  <p class="pixel dim">we celebrate their courage. the judges did not.</p>

  <h2 style="margin-top: 2rem;">LOWEST SURVIVING SCORES</h2>
  <div class="cat-grid">
    {worstCats.map((s) => <CatCard sample={s} anchor={`shame-${modelDir(s.modelSlug)}-${s.promptId}-${s.sample}`} />)}
  </div>

  <h2 style="margin-top: 3rem;">THE CONSCIENTIOUS OBJECTORS</h2>
  <p class="pixel dim" style="font-size: 0.8rem;">models that declined the assignment, quoted verbatim.</p>
  {refusals.map((r) => (
    <div class="gameover" style="margin-top: 1rem;">
      <span class="go-title">GAME OVER — {r.modelName}</span>
      <p class="pixel dim" style="margin: 0.3rem 0 0; font-size: 0.75rem;">asked for: {r.promptId}</p>
      <blockquote>{r.quote}</blockquote>
    </div>
  ))}
</Base>
```

- [ ] **Step 4: Run to verify pass** — full suite green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: gallery and hall of shame pages"
```

---

### Task 8: Arena (CAT FIGHT) + live Crowd Score

**Files:**
- Create: `packages/site/src/pages/arena.astro`, `src/scripts/arena.ts` (inlined as a module script), replace `src/components/CrowdScore.astro`
- Modify: `packages/site/test/build-output.test.ts` (append)

Config: the vote worker base URL comes from `PUBLIC_VOTE_API` (Astro public env var, e.g. `https://meowbench-vote.<account>.workers.dev`). When unset or unreachable, the Arena shows an "ARCADE OFFLINE" state and Crowd column stays "—". No hard dependency for the static build.

- [ ] **Step 1: Append failing tests**

```ts
test('arena page ships the fighter manifest and offline fallback', () => {
  const arena = readFileSync(join(SITE, 'dist', 'arena', 'index.html'), 'utf8')
  expect(arena).toContain('CAT FIGHT')
  expect(arena).toContain('id="fighter-manifest"')
  expect(arena).toContain('ARCADE OFFLINE')
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write the arena**

`packages/site/src/pages/arena.astro`:
```astro
---
import Base from '../layouts/Base.astro'
import { loadRun } from '../lib/run-data'
const run = loadRun()
// fighters: valid rendered samples grouped by prompt, ≥2 distinct models per prompt
const manifest = Object.fromEntries(
  run.prompts
    .map((p) => [
      p.id,
      run.allSamples
        .filter((s) => s.promptId === p.id && s.valid && s.pngPath)
        .map((s) => ({ id: s.id, model: s.modelSlug, name: s.modelName, png: s.pngPath })),
    ])
    .filter(([, list]) => new Set((list as { model: string }[]).map((f) => f.model)).size >= 2),
)
const voteApi = import.meta.env.PUBLIC_VOTE_API ?? ''
---
<Base title="Arena" current="/arena/">
  <h1 style="margin-top: 1.5rem; text-align: center;">CAT FIGHT</h1>
  <p class="pixel" style="text-align: center; color: var(--mint);">two cats. same assignment. <span class="blink">CHOOSE YOUR FIGHTER</span></p>

  <div id="arena-stage" style="display: none;">
    <p class="pixel dim" id="arena-prompt" style="text-align: center;"></p>
    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; margin-top: 1rem;">
      <button class="cat-card" id="fighter-a" style="cursor: pointer;"><img alt="fighter A" /></button>
      <span class="pixel" style="color: var(--pink); font-size: 1.4rem; text-shadow: var(--glow-pink);">VS</span>
      <button class="cat-card" id="fighter-b" style="cursor: pointer;"><img alt="fighter B" /></button>
    </div>
    <div id="arena-result" class="panel pixel" style="display: none; text-align: center; margin-top: 1.2rem;"></div>
    <p style="text-align: center; margin-top: 1.2rem;"><button class="btn btn--mint" id="next-battle" style="display: none;">NEXT BATTLE ▸</button></p>
  </div>

  <noscript>
    <div class="gameover" style="margin-top: 2rem; text-align: center;">
      <span class="go-title">ARCADE NEEDS JAVASCRIPT</span>
      <p class="pixel dim">voting requires js — everything else on this site works without it.</p>
    </div>
  </noscript>

  <div id="arena-offline" class="gameover" style="display: none; margin-top: 2rem; text-align: center;">
    <span class="go-title">ARCADE OFFLINE</span>
    <p class="pixel dim">the vote machine is unplugged. scores are safe. try again later.</p>
  </div>

  <script type="application/json" id="fighter-manifest" set:html={JSON.stringify(manifest)} />
  <script type="application/json" id="vote-api" set:html={JSON.stringify(voteApi)} />
  <script>
    const manifest = JSON.parse(document.getElementById('fighter-manifest')!.textContent!) as Record<string, { id: string; model: string; name: string; png: string }[]>
    const VOTE_API = JSON.parse(document.getElementById('vote-api')!.textContent!) as string
    const stage = document.getElementById('arena-stage')!
    const offline = document.getElementById('arena-offline')!
    const promptEl = document.getElementById('arena-prompt')!
    const result = document.getElementById('arena-result')!
    const next = document.getElementById('next-battle')!
    const btnA = document.getElementById('fighter-a') as HTMLButtonElement
    const btnB = document.getElementById('fighter-b') as HTMLButtonElement

    let current: { promptId: string; a: (typeof manifest)[string][number]; b: (typeof manifest)[string][number] } | null = null

    function pick() {
      const prompts = Object.keys(manifest)
      const promptId = prompts[Math.floor(Math.random() * prompts.length)]
      const pool = manifest[promptId]
      let a = pool[Math.floor(Math.random() * pool.length)]
      let b = pool[Math.floor(Math.random() * pool.length)]
      let guard = 0
      while (b.model === a.model && guard++ < 50) b = pool[Math.floor(Math.random() * pool.length)]
      if (b.model === a.model) return pick()
      current = { promptId, a, b }
      promptEl.textContent = `assignment: ${promptId}`
      ;(btnA.querySelector('img') as HTMLImageElement).src = a.png
      ;(btnB.querySelector('img') as HTMLImageElement).src = b.png
      result.style.display = 'none'
      next.style.display = 'none'
      btnA.disabled = btnB.disabled = false
      stage.style.display = 'block'
    }

    async function vote(winner: 'a' | 'b') {
      if (!current) return
      btnA.disabled = btnB.disabled = true
      const w = winner === 'a' ? current.a : current.b
      const l = winner === 'a' ? current.b : current.a
      try {
        const res = await fetch(`${VOTE_API}/api/vote`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ winnerId: w.id, loserId: l.id, promptId: current.promptId }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { winner: { model: string; rating: number }; loser: { model: string; rating: number } }
        result.innerHTML = `<span style="color: var(--yellow)">WINNER: ${w.name}</span> — new rating ${data.winner.rating}<br /><span class="dim">${l.name} falls to ${data.loser.rating}</span>`
      } catch {
        result.innerHTML = `<span style="color: var(--yellow)">WINNER: ${w.name}</span><br /><span class="dim">(vote not recorded — the machine blinked. it happens.)</span>`
      }
      result.style.display = 'block'
      next.style.display = 'inline-block'
    }

    btnA.addEventListener('click', () => vote('a'))
    btnB.addEventListener('click', () => vote('b'))
    next.addEventListener('click', pick)

    if (!VOTE_API) {
      offline.style.display = 'block'
      // still let people play offline — votes just aren't recorded
      pick()
    } else {
      pick()
    }
  </script>
</Base>
```

Replace `src/components/CrowdScore.astro` (progressive enhancement for the home leaderboard):
```astro
---
const voteApi = import.meta.env.PUBLIC_VOTE_API ?? ''
---
<script type="application/json" id="crowd-api" set:html={JSON.stringify(voteApi)} />
<script>
  const api = JSON.parse(document.getElementById('crowd-api')!.textContent!) as string
  if (api) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    fetch(`${api}/api/standings`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { standings: { model: string; rating: number }[] }) => {
        clearTimeout(timer)
        for (const s of data.standings) {
          const cell = document.querySelector(`[data-crowd="${CSS.escape(s.model)}"]`)
          if (cell) cell.textContent = String(s.rating)
        }
      })
      .catch(() => {/* column stays “—” — the crowd is asleep */})
  }
</script>
```

- [ ] **Step 4: Run to verify pass** — full suite green (build-output now 8 tests total).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cat fight arena with vote worker integration and live crowd scores"
```

---

### Task 9: Methodology page + final polish

**Files:**
- Create: `packages/site/src/pages/methodology.astro`
- Modify: `packages/site/test/build-output.test.ts` (append)

- [ ] **Step 1: Append failing test**

```ts
test('methodology documents the full protocol', () => {
  const m = readFileSync(join(SITE, 'dist', 'methodology', 'index.html'), 'utf8')
  for (const s of ['meowscore', 'K=32', 'OpenRouter', 'resvg', 'prompt_fidelity', 'rate limit']) {
    expect(m.toLowerCase()).toContain(s.toLowerCase())
  }
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write `src/pages/methodology.astro`** — complete, written prose (the rigor page; body font, generous line length):

```astro
---
import Base from '../layouts/Base.astro'
import { loadRun } from '../lib/run-data'
const run = loadRun()
---
<Base title="Methodology" current="/methodology/">
  <article style="max-width: 44rem;">
    <h1 style="margin-top: 1.5rem;">METHODOLOGY</h1>
    <p class="pixel" style="color: var(--mint);">the rigor is real. the subject is cats.</p>

    <h2>The task</h2>
    <p>Every model receives the identical system prompt and six escalating assignments: a minimal flat-design cat, a realistic sitting cat, a cat riding a bicycle, an origami-style cat, a recognizable cat in at most 12 SVG elements, and a cat whose tail sways using SMIL or CSS animation only. Four attempts per assignment, temperature pinned to 1.0 where the provider supports it. Twenty-four attempts per model, no retries for quality — a refusal is a result.</p>

    <h2>The pipeline</h2>
    <p>Generation runs through OpenRouter against each model's public API. Every returned SVG passes a programmatic gate: it must parse as XML, contain no scripts, no event handlers, no embedded raster images, no external references, no DOCTYPE entity tricks, and stay under 500KB. Valid SVGs are rendered to 800px PNGs with resvg — deterministic, no browser involved. Degenerate geometry that would hang a renderer is rejected. The pipeline is resumable and every artifact is committed to the repository: any score on this site can be audited back to the raw model output that produced it.</p>

    <h2>The judges</h2>
    <p>Each rendered cat goes to a panel of three vision models, which score four axes from 0–10: <strong>cat_likeness</strong> (is this recognizably a cat?), <strong>aesthetic</strong> (is it pleasing?), <strong>technique</strong> (structural quality of the SVG source, which judges also receive), and <strong>prompt_fidelity</strong> (did it do the assignment?). A sample's axis score is the median across judges. Judges never see model names. SVG comments are stripped before judging so models can't smuggle instructions to the panel; remaining injection surface (title and description text) is disclosed here rather than pretended away.</p>

    <h2>The meowscore</h2>
    <p>Per sample: the mean of the four axis medians. Per assignment: the median of the four attempts (best-of-four is also recorded). The headline <strong>meowscore</strong> is the mean of the six per-assignment medians, scaled to 0–100. Invalid or refused samples score zero — models don't get to skip the hard ones. Sample counts are published per assignment so partial runs are visible.</p>

    <h2>The crowd</h2>
    <p>The <a href="/arena/">arena</a> shows two anonymous cats from the same assignment; you pick the better one. Ratings use Elo with K=32 from a 1500 start, updated atomically per vote. The crowd column is deliberately separate from the meowscore — the judges and the crowd are allowed to disagree, and that disagreement is data. Votes are rate limited (10 per minute per IP, stored as a salted hash — never the raw address). The rate limit is a soft cap: a burst can slip a vote or two past it, which we consider acceptable for a cat-drawing leaderboard and disclose anyway.</p>

    <h2>Reproduce it</h2>
    <p>The whole harness is open source. Clone <a href="https://github.com/adoistic/meowbench">the repository</a>, set an OpenRouter key, and run <code>pnpm -F @meowbench/harness cli run --run-dir runs/my-run --estimate</code> to see what it would cost before spending a cent. Current run on this site: <code>{run.runId}</code>{run.runId.includes('fixture') && ' (synthetic demo data — the machine is honest about this)'}.</p>

    <h2>Known limitations</h2>
    <ul>
      <li>Cost estimates are flat-rate approximations; the estimator is a floor, not a ceiling.</li>
      <li>Refusal detection is English-only; non-English refusals are counted as "no SVG" (same score: zero).</li>
      <li>Judges may share training lineage with contestants; panel composition is disclosed per run.</li>
      <li>The animation assignment is judged from a static frame until motion verification ships.</li>
    </ul>
  </article>
</Base>
<style>
  article h2 { margin-top: 2.4rem; }
  article p, article li { color: var(--ink); }
  article code { font-family: var(--font-pixel); font-size: 0.85em; color: var(--yellow); background: #0d0721; padding: 0.1em 0.4em; border-radius: 4px; }
</style>
```

- [ ] **Step 4: Run full suite + build; verify all green.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: methodology page"
```

---

### Task 10: Visual QA pass + deployment docs

**Files:**
- Create: `packages/site/README.md`
- Possibly modify: `src/styles/arcade.css` and pages (QA fixes only)

- [ ] **Step 1: Serve and screenshot every page**

Run: `pnpm -F @meowbench/site build && pnpm -F @meowbench/site preview` (background), then screenshot `/`, `/gallery/`, `/arena/`, `/shame/`, `/methodology/`, and one model page at desktop (1280w) and mobile (390w) widths using the available browser tooling. Check against the design direction:
- Scanlines visible but subtle; text readable through them
- Marquee chase-lights animate; hero type glows without blooming into illegibility
- Top-3 leaderboard rows read as gold/silver/bronze at a glance
- `<details>` rows open/close correctly with keyboard (Tab + Enter)
- Lightboxes open via click and close via ✕ with NO JavaScript (test with JS disabled)
- Mobile: no horizontal scroll, nav wraps, grids collapse
- Fix what fails; keep fixes surgical. Screenshot again after fixes.

- [ ] **Step 2: Accessibility spot-check**

- Every `img` has alt text (grep dist for `<img` without `alt=`) — expect zero
- Focus states visible on `.btn`, summary rows, cat cards (add `:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }` to arcade.css if missing — add it in Task 1? No: add it NOW as part of QA if absent)
- Contrast: `--ink-dim` on `--panel` is the riskiest pair; verify ≥ 4.5:1 for body-size text or bump the color

- [ ] **Step 3: Write `packages/site/README.md`**

```markdown
# @meowbench/site

The meowbench arcade. Astro static site, deployed to Cloudflare Pages.

## Develop
pnpm -F @meowbench/site dev        # dev server against the latest run in runs/
pnpm -F @meowbench/site test       # data-layer + build-output tests
pnpm -F @meowbench/site build      # prebuild syncs renders into public/run/

## Data
The site builds from the lexically-latest `runs/<id>/` containing a leaderboard.json.
Override with MEOWBENCH_RUN=<run-id>. The committed `2026-07-04_dev-fixture` run is
synthetic demo data; the home page shows a DEMO MODE banner while it's the latest run.

## Deploy (Cloudflare Pages)
1. Pages project → connect repo, build command `pnpm -F @meowbench/site build`,
   output dir `packages/site/dist`, root `/`.
2. Env var `PUBLIC_VOTE_API` = the deployed vote worker origin
   (e.g. https://meowbench-vote.<account>.workers.dev). Leave unset to run the site
   with the arena in offline mode.
3. New benchmark run: commit the run folder, redeploy. Re-seed the vote worker
   (see packages/vote-worker plan runbook) so the arena manifest matches.
```

- [ ] **Step 4: Full suite + build one last time; commit**

```bash
git add -A && git commit -m "polish: visual QA fixes, a11y spot-checks, site README"
```

---

## Done criteria for this plan

- `pnpm -F @meowbench/site test` green (data layer, fixture, build-output assertions).
- `pnpm -F @meowbench/site build` produces a complete static site from the latest run with zero JS required anywhere except the Arena and the Crowd column.
- All six page types render with the arcade design system; screenshots at both widths pass the Task 10 QA checklist.
- The Arena degrades gracefully with `PUBLIC_VOTE_API` unset (offline mode) and when the worker rejects/fails.
- The DEMO MODE banner appears while the fixture is the latest run and disappears automatically when a real run lands.

**Deferred (tracked, not in this plan):** "animates" badge via checkMotion integration; rank-movement arrows (needs ≥2 runs); gallery model-name filter (JS); Turnstile on voting; CI workflow for the monorepo.
