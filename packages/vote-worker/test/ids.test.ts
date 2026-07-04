import { expect, test } from 'vitest'
import { parseSampleId, hashIp } from '../src/ids.js'

test('parseSampleId splits a well-formed id', () => {
  expect(parseSampleId('openai/gpt-4o|action|3')).toEqual({
    modelSlug: 'openai/gpt-4o', promptId: 'action', sample: 3,
  })
})

test('parseSampleId returns null for malformed ids', () => {
  expect(parseSampleId('')).toBeNull()
  expect(parseSampleId('nopipe')).toBeNull()
  expect(parseSampleId('a|b')).toBeNull()          // too few parts
  expect(parseSampleId('a|b|c|d')).toBeNull()       // too many parts
  expect(parseSampleId('a|b|notanumber')).toBeNull()
  expect(parseSampleId('a|b|0')).toBeNull()         // sample is 1-based
  expect(parseSampleId('a|b|-1')).toBeNull()
})

test('hashIp is deterministic, salted, and hex', async () => {
  const a = await hashIp('1.2.3.4', 'salt')
  const b = await hashIp('1.2.3.4', 'salt')
  const c = await hashIp('1.2.3.4', 'other-salt')
  expect(a).toBe(b)
  expect(a).not.toBe(c)
  expect(a).toMatch(/^[0-9a-f]{64}$/)
})
