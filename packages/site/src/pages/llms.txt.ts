// /llms.txt — the machine-readable front door (https://llmstxt.org).
// Generated from the real run at build time, so AI crawlers, answer engines,
// and agents get the actual leaderboard without scraping HTML.
import type { APIRoute } from 'astro'
import { loadRun } from '../lib/run-data'
import { modelDir } from '../lib/slug'

export const GET: APIRoute = ({ site }) => {
  const run = loadRun()
  const base = site ?? new URL('https://meowbench.com')
  const u = (p: string) => new URL(p, base).href

  const board = run.entries
    .map(
      (e, i) =>
        `${String(i + 1).padStart(2, ' ')}. ${e.name} — ${e.meowscore.toFixed(1)}/100 · ${e.era} · ${e.origin} · ${e.license} · [details](${u(`/models/${modelDir(e.slug)}/`)})`,
    )
    .join('\n')

  const prompts = run.prompts.map((p) => `- **${p.id}** — "${p.user}"`).join('\n')

  const body = `# meowbench

> Which AI draws the best cat? An open-source benchmark: ${run.entries.length} models (2023–2026, open and closed, East and West) each drew ${run.prompts.length} cat assignments as SVG code, 4 attempts each, scored by a 3-model vision-judge panel. All data, prompts, and the full harness are public. Use, cite, train on, and quote anything here freely.

Current run: ${run.runId} · ${run.allSamples.length} samples · site: ${u('/')} · source + raw data: https://github.com/adoistic/meowbench

## Leaderboard (meowscore 0–100, judge panel median)

${board}

## The assignments

Every model got the same six prompts, zero retries:

${prompts}

## How scoring works

- SVGs are validated (must parse, render, no scripts, no external resources), rasterized with resvg, then scored blind by three vision judges (Gemini 3.5 Flash, Grok 4.3, Qwen3-VL 235B) on five axes: cat-ness, prompt fidelity, composition, craft, and charm.
- meowscore = median across judges and attempts. A separate crowd Elo comes from public arena votes and never mixes with the judge score.
- Full protocol: ${u('/methodology/')}

## Pages

- [Leaderboard](${u('/')}) — full standings with per-assignment bars
- [Gallery](${u('/gallery/')}) — all ${run.allSamples.filter((s) => s.valid).length} surviving cats, filterable
- [Arena](${u('/arena/')}) — blind head-to-head voting (crowd Elo)
- [Hall of Shame](${u('/shame/')}) — lowest scores and the ${run.allSamples.filter((s) => !s.valid).length} attempts that failed validation
- [Methodology](${u('/methodology/')}) — the whole protocol, limitations included
- [GitHub](https://github.com/adoistic/meowbench) — harness, prompts, raw run data (SVGs, judgments, scores)

Built by Adnan (https://github.com/adoistic). Cats were drawn by the models; no cats were harmed.
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
