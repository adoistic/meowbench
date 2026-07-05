import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = fileURLToPath(new URL('..', import.meta.url))
const ROOT = join(SITE, '..', '..')
const RUNS = join(ROOT, 'runs')

function latestRunId(): string {
  if (process.env.MEOWBENCH_RUN) return process.env.MEOWBENCH_RUN
  // Invariant: run directory names must sort lexically in chronological order (YYYY-MM-DD prefix);
  // a same-date name sorting before the fixture would silently lose.
  const dirs = readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RUNS, d.name, 'leaderboard.json')))
    .map((d) => d.name)
    .sort()
  if (!dirs.length) throw new Error('no runs found')
  return dirs[dirs.length - 1]
}

/**
 * Copy the latest run's generated .svg files into public/run/svg/, mirroring the
 * <modelDir>/<promptId>/sample-N.svg layout. The site displays these directly (crisp,
 * animated) via <img>; the PNG renders stay in the run folder as judge input only.
 * Returns the SVG count.
 */
export function syncAssets(): number {
  const runId = latestRunId()
  const src = join(RUNS, runId, 'generations')
  const dest = join(SITE, 'public', 'run', 'svg')
  rmSync(join(SITE, 'public', 'run'), { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  let count = 0
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name.endsWith('.svg')) {
        const out = join(dest, relative(src, abs))
        mkdirSync(dirname(out), { recursive: true })
        copyFileSync(abs, out)
        count++
      }
    }
  }
  walk(src)
  console.log(`synced ${count} svgs from ${runId}`)
  return count
}

if (process.argv[1]?.endsWith('sync-assets.ts')) syncAssets()
