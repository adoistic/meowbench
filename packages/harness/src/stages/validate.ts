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
