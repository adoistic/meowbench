import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRunId } from '../src/lib/run-data.js'

const SITE = fileURLToPath(new URL('..', import.meta.url))
const ROOT = join(SITE, '..', '..')
const RUNS = join(ROOT, 'runs')

/**
 * Copy the latest run's generated .svg files into public/run/svg/, mirroring the
 * <modelDir>/<promptId>/sample-N.svg layout. The site displays these directly (crisp,
 * animated) via <img>; the PNG renders stay in the run folder as judge input only.
 * Returns the SVG count.
 */
export function syncAssets(): number {
  const runId = resolveRunId()
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
