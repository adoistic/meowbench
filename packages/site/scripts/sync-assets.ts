import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
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
