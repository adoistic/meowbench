import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'

const SITE = fileURLToPath(new URL('..', import.meta.url))
let html = ''

beforeAll(() => {
  execSync('pnpm build', { cwd: SITE, stdio: 'inherit' })
  html = readFileSync(join(SITE, 'dist', 'index.html'), 'utf8')
}, 240_000)

test('home page renders the full leaderboard', () => {
  expect(html).toContain('WHICH AI DRAWS THE BEST CAT?')
  expect(html).toContain('Claude Sonnet 4') // fixture top entry
  expect((html.match(/score-row/g) ?? []).length).toBeGreaterThanOrEqual(10)
})

test('rows carry per-prompt bars and best-cat images without JS', () => {
  expect(html).toContain('class="bar"')
  expect(html).toContain('/run/renders/')
  expect(html).toContain('<details') // expandable rows are native details
})
