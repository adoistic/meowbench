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
