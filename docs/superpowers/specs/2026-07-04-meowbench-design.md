# meowbench — Design Spec

**Date:** 2026-07-04
**Author:** Adnan (Thothica)
**Status:** Approved

## What is this?

**meowbench** is an open-source benchmark that answers one question with unreasonable rigor: *which AI model draws the best cat as an SVG?*

Models from every era and origin — previous-generation workhorses, Chinese open-source models, frontier closed-source models — are given the same cat-drawing prompts. Their SVGs are validated, rendered, scored by a vision-model judge panel, and ranked. A neon arcade-style website shows the leaderboard, a gallery of every cat, a community voting arena, and a Hall of Shame.

Rigorous but fun. The rigor is real; the subject is cats.

## Core decisions (locked)

| Decision | Choice |
|---|---|
| Deliverable | Harness + site as equal citizens in one monorepo |
| Scoring | Hybrid: programmatic checks + 3-judge vision panel + community Elo |
| Task | 6-prompt themed suite, escalating difficulty |
| Model access | OpenRouter, ~25–40 models at launch |
| Stack | TypeScript everywhere; Astro + Cloudflare Pages/Workers/D1 |
| Protocol | 4 samples per model×prompt, 3 vision judges, median aggregation |
| Name | meowbench |
| Visual direction | "The Arcade" — neon, game-show energy, Elo as high scores |
| Source of truth | Run results committed to the repo; site builds statically from them |

## Repo structure

pnpm workspace monorepo:

```
meowbench/
├── packages/
│   ├── harness/        # CLI: generate → validate → render → judge → compile
│   ├── site/           # Astro site (Cloudflare Pages)
│   └── vote-worker/    # Cloudflare Worker + D1: Elo voting API
├── prompts/prompts.json    # versioned 6-prompt suite
├── models.json             # roster: OpenRouter slugs + metadata (era, origin, license)
└── runs/                   # committed results = source of truth
    └── <date>_run-<nnn>/
        ├── generations/<model>/<prompt>/sample-{1..4}.svg   (+ raw responses)
        ├── renders/<model>/<prompt>/sample-{1..4}.png
        ├── scores.json         # per-sample: auto checks + judge scores
        └── leaderboard.json    # compiled output the site renders
```

Every generated cat is in git. Any score is auditable back to the raw SVG, the raw model response, and the exact prompt version that produced it.

## The prompt suite (v1)

Six prompts, escalating difficulty. Identical system+user prompt per model, temperature pinned to 1.0 (where the provider supports it; actual value recorded per sample), 4 samples each:

1. **minimal** — "a minimal, flat-design cat"
2. **realistic** — "a realistic sitting cat with visible fur shading"
3. **action** — "a cat riding a bicycle"
4. **style** — "an origami-style cat, geometric folds"
5. **constraint** — "a recognizable cat using at most 12 SVG elements"
6. **animation** — "a cat with a tail that sways, using SMIL/CSS animation only"

Prompts are versioned in `prompts/prompts.json`; a run records which prompt version it used. Changing a prompt bumps the suite version and makes runs non-comparable across versions (the site only compares runs of the same suite version).

## Harness pipeline

Node CLI (`meowbench <stage>`), five resumable stages. Each stage writes into the run folder and skips completed work, so crashed runs resume for free and re-judging never re-generates.

### 1. `generate`
For each model × prompt × sample: call OpenRouter, store the raw response and the extracted SVG separately. Refusals, timeouts, and "no SVG in output" are recorded as failures (max 2 retries, transport errors only — a refusal is a result, not an error).

### 2. `validate`
Programmatic gate per SVG:
- parses as XML; root element is `<svg>`
- no embedded raster (`<image>` with data URIs), no external refs, no `<script>`
- under 500KB

Also collects display stats: element count, path count, distinct colors, byte size.

### 3. `render`
SVG → 800×800 PNG via **resvg-js** (deterministic, no browser). Render failure ⇒ sample invalid. The **animation** prompt additionally renders in headless Chromium, capturing 3 frames at t=0s/0.5s/1s to verify motion; frame-difference > threshold ⇒ "animates" flag.

### 4. `judge`
Each valid PNG (plus the SVG source) goes to a 3-model vision judge panel. Judge roster picked at implementation time from current OpenRouter availability (target: one each from OpenAI / Google / Qwen families). Fixed rubric, each axis 0–10:

- **cat-likeness** — is this recognizably a cat?
- **aesthetic appeal** — is it pleasing?
- **technique** — structural quality of the SVG source (judges receive the source too)
- **prompt fidelity** — did it do what the prompt asked (bicycle, ≤12 elements, animation…)?

Per-sample axis score = median of the 3 judges. Judges never see model names. Self-family judging (a judge scoring its own family's cats) is not excluded but is disclosed on the methodology page.

### 5. `compile`
- Per-sample score = mean of the 4 rubric axes. Invalid/refused samples score **0** — models don't get to skip hard prompts.
- Per-prompt score = **median** of the 4 samples (best-of-4 also reported).
- Headline **meowscore** = mean of the 6 per-prompt scores, scaled to 0–100.
- Community Elo is a separate "Crowd Score" column, never merged into meowscore.
- Output: `scores.json` (full detail) and `leaderboard.json` (what the site consumes).

## Website

Astro on Cloudflare Pages. "The Arcade" visual direction: neon palette on dark purple, arcade high-score energy, big type, playful microcopy; rigor lives in each cat's stats. Statically built from the latest run's `leaderboard.json` at deploy time. Everything except the Arena works with JavaScript disabled.

Pages:

- **Home** — neon hero ("WHICH AI DRAWS THE BEST CAT?"), leaderboard as arcade high-score table. Rows expand: best cat, meowscore breakdown per axis and prompt, fun stats (element count, refusal rate). Rank-movement arrows vs previous run.
- **Gallery** — every cat in the current run, filterable by model / prompt / validity. Lightbox: rendered PNG, syntax-highlighted SVG source, judge scores.
- **Arena** — two anonymous rendered cats from the same prompt: "WHICH CAT WINS?" Vote, then reveal the models. Pairings chosen client-side from static data; vote POSTs to the worker.
- **Hall of Shame** — the most catastrophic attempts, plus the funniest refusals quoted verbatim.
- **Methodology** — full protocol, rubric text, judge panel + disclosure policy, prompt versioning, reproduction instructions (run it with your own OpenRouter key).
- **Model pages** — one per model: all 24 samples, per-prompt breakdown, era/origin/license metadata.

## Vote worker

Cloudflare Worker + D1:

- `POST /api/vote` — `{winnerId, loserId, promptId}`; validates both sample IDs against a manifest table seeded into D1 at deploy time; Elo update (K=32, start 1500); stores raw vote row (timestamp, IP hash, pair, outcome).
- `GET /api/standings` — Elo table, edge-cached 60s. The site polls this so Crowd Score stays live between deploys.
- Abuse control at launch: per-IP rate limit (10 votes/min) + pair validation. Turnstile only if bots actually show up.

## Testing

- **Harness:** unit tests for validator + compiler against fixture SVGs (valid cat, raster smuggler, script injection, malformed XML, oversized). OpenRouter/judge calls mocked. `--dry-run` runs the full pipeline on 2 fake models with canned responses.
- **Worker:** vitest + Cloudflare test pool for vote validation and Elo math.
- **Site:** CI build + schema check that `leaderboard.json` matches the site's expected shape.
- **Cost guard:** `meowbench run --estimate` prints projected API cost before spending money.

## Cost envelope (per full run)

~30 models × 6 prompts × 4 samples = **720 generations**; valid ones × 3 judges ≈ **≤2,160 judge calls**. Estimated tens of dollars per run at current OpenRouter pricing; `--estimate` gives the real number per roster.

## Out of scope for v1

- Local-weights inference (Ollama/HF) for dead models — noted as a v2 "archaeology tier"
- Turnstile/CAPTCHA on voting
- Historical trend charts across runs (needs ≥2 runs first)
- Non-cat subjects (no. it's cats.)
