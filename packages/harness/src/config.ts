import { readFileSync } from 'node:fs'
import type { ModelSpec, PromptSuite } from './types.js'

export function loadSuite(path: string): PromptSuite {
  const suite = JSON.parse(readFileSync(path, 'utf8')) as PromptSuite
  if (!suite.version || !suite.system || !Array.isArray(suite.prompts)) {
    throw new Error(`invalid prompt suite: ${path}`)
  }
  return suite
}

export function loadModels(path: string): ModelSpec[] {
  const models = JSON.parse(readFileSync(path, 'utf8')) as ModelSpec[]
  for (const m of models) {
    if (!m.slug || !m.name || !m.era) throw new Error(`invalid model entry: ${JSON.stringify(m)}`)
  }
  return models
}
