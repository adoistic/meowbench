import { expect, test } from 'vitest'
import { expectedScore, updateRatings, START_RATING, K_FACTOR } from '../src/elo.js'

test('constants match the spec', () => {
  expect(START_RATING).toBe(1500)
  expect(K_FACTOR).toBe(32)
})

test('expectedScore is 0.5 for equal ratings and symmetric', () => {
  expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10)
  expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1, 10)
})

test('higher rating has expected score above 0.5', () => {
  expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5)
})

test('updateRatings: equal ratings, winner gains K/2, loser loses K/2', () => {
  const { winner, loser } = updateRatings(1500, 1500)
  expect(winner).toBeCloseTo(1516, 6) // 1500 + 32*(1-0.5)
  expect(loser).toBeCloseTo(1484, 6)
  // zero-sum: total rating is conserved
  expect(winner + loser).toBeCloseTo(3000, 6)
})

test('updateRatings: exposes the delta (winner gain == loser loss)', () => {
  const r = updateRatings(1500, 1500)
  expect(r.delta).toBeCloseTo(16, 6)
  expect(r.delta).toBeCloseTo(r.winner - 1500, 6)
  expect(r.delta).toBeCloseTo(1500 - r.loser, 6)
})

test('updateRatings: a heavy favorite winning gains little', () => {
  const { winner, loser } = updateRatings(1900, 1500)
  expect(winner - 1900).toBeLessThan(4) // favorite barely moves
  expect(1500 - loser).toBeLessThan(4)
})

test('updateRatings: an upset moves ratings a lot', () => {
  const { winner, loser } = updateRatings(1400, 1800) // low-rated wins
  expect(winner - 1400).toBeGreaterThan(28)
  expect(1800 - loser).toBeGreaterThan(28)
})
