import { expect, test } from 'vitest'
import { checkMotion } from '../src/animate.js'

const gated = process.env.MEOWBENCH_CHROMIUM ? test : test.skip

const WAGGING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="45" y="20" width="10" height="60" fill="black">
    <animateTransform attributeName="transform" type="rotate" from="-20 50 80" to="20 50 80"
      dur="0.4s" repeatCount="indefinite"/>
  </rect></svg>`

const STATIC = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50"/></svg>'

gated('detects SMIL motion', async () => {
  expect(await checkMotion(WAGGING)).toBe(true)
}, 30_000)

gated('static svg has no motion', async () => {
  expect(await checkMotion(STATIC)).toBe(false)
}, 30_000)
