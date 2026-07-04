import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { syncAssets } from '../scripts/sync-assets.js'

const SITE = fileURLToPath(new URL('..', import.meta.url))

test('syncAssets copies the latest run renders into public/run and is idempotent', () => {
  rmSync(join(SITE, 'public', 'run'), { recursive: true, force: true })
  const n1 = syncAssets()
  expect(n1).toBeGreaterThan(200) // 240 samples minus refusals/invalid
  expect(existsSync(join(SITE, 'public', 'run', 'renders', 'anthropic__claude-sonnet-4', 'minimal', 'sample-1.png'))).toBe(true)
  const n2 = syncAssets()
  expect(n2).toBe(n1) // idempotent count, re-copy is fine
})
