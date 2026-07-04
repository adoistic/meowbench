import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { loadModels, loadSuite } from '../src/config.js'

test('loads the prompt suite with 6 prompts and a system prompt', () => {
  const suite = loadSuite(fileURLToPath(new URL('../../../prompts/prompts.json', import.meta.url)))
  expect(suite.version).toBe(1)
  expect(suite.prompts).toHaveLength(6)
  expect(suite.system).toContain('SVG')
  expect(suite.prompts.map((p) => p.id)).toEqual([
    'minimal', 'realistic', 'action', 'style', 'constraint', 'animation',
  ])
})

test('loads models with required fields', () => {
  const models = loadModels(fileURLToPath(new URL('../../../models.json', import.meta.url)))
  expect(models.length).toBeGreaterThanOrEqual(2)
  for (const m of models) {
    expect(m.slug).toMatch(/^[\w.-]+\/[\w.:-]+$/)
    expect(['legacy', 'previous', 'current']).toContain(m.era)
  }
})
