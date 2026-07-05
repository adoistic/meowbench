import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { syncAssets } from '../scripts/sync-assets.js'

const SITE = fileURLToPath(new URL('..', import.meta.url))

test('syncAssets copies the latest run svgs into public/run/svg and is idempotent', () => {
  rmSync(join(SITE, 'public', 'run'), { recursive: true, force: true })
  const n1 = syncAssets()
  expect(n1).toBeGreaterThan(200) // 240 samples minus refusals/invalid
  expect(existsSync(join(SITE, 'public', 'run', 'svg', 'anthropic__claude-sonnet-4', 'minimal', 'sample-1.svg'))).toBe(true)
  const n2 = syncAssets()
  expect(n2).toBe(n1) // idempotent count, re-copy is fine
})
