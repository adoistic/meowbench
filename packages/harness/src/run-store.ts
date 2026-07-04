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
