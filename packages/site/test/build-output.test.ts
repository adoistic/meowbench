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

test('model pages exist with all samples and lightboxes', () => {
  const model = readFileSync(join(SITE, 'dist', 'models', 'anthropic__claude-sonnet-4', 'index.html'), 'utf8')
  expect(model).toContain('Claude Sonnet 4')
  expect((model.match(/class="cat-card"/g) ?? []).length).toBeGreaterThanOrEqual(20)
  expect(model).toContain('class="lightbox"') // :target lightbox, no JS
  expect(model).toContain('astro-code synthwave-84') // Shiki-highlighted SVG source present
  // Shiki tokenizes `<svg` into adjacent spans and escapes `<` as a numeric entity, not `&lt;`
  expect(model).toMatch(/&#x3C;<\/span><span[^>]*>svg/)
})
