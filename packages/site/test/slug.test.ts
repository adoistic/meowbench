import { expect, test } from 'vitest'
import { modelDir, sampleId } from '../src/lib/slug.js'

test('modelDir mirrors the harness convention', () => {
  expect(modelDir('openai/gpt-4o')).toBe('openai__gpt-4o')
})

test('sampleId mirrors the vote-worker convention', () => {
  expect(sampleId('openai/gpt-4o', 'action', 3)).toBe('openai/gpt-4o|action|3')
})
