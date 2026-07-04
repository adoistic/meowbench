import { expect, test } from 'vitest'
import { mean, median, round1 } from '../src/stats.js'

test('median of odd and even counts', () => {
  expect(median([3, 1, 2])).toBe(2)
  expect(median([4, 1, 3, 2])).toBe(2.5)
})

test('mean and round1', () => {
  expect(mean([1, 2, 6])).toBe(3)
  expect(round1(3.14159)).toBe(3.1)
})

test('empty input throws', () => {
  expect(() => median([])).toThrow()
  expect(() => mean([])).toThrow()
})
