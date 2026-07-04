import { expect, test } from 'vitest'
import { parseSamples } from '../src/cli.js'

test('parseSamples rejects junk and accepts positive ints', () => {
  expect(parseSamples('4')).toBe(4)
  expect(() => parseSamples('abc')).toThrow(/positive integer/)
  expect(() => parseSamples('0')).toThrow()
  expect(() => parseSamples('-2')).toThrow()
  expect(() => parseSamples('2.5')).toThrow()
})
