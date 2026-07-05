import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'

const SITE = fileURLToPath(new URL('..', import.meta.url))
let html = ''

beforeAll(() => {
  // PUBLIC_GA_ID mirrors a configured production build. Without it the whole
  // consent module tree-shakes to zero bytes (correct when unconfigured), so
  // the analytics assertions below would have nothing to find.
  execSync('pnpm build', { cwd: SITE, stdio: 'inherit', env: { ...process.env, PUBLIC_GA_ID: 'G-TESTBUILD1' } })
  html = readFileSync(join(SITE, 'dist', 'index.html'), 'utf8')
}, 240_000)

test('home page renders the full leaderboard', () => {
  expect(html).toContain('WHICH AI DRAWS THE BEST CAT?')
  expect(html).toContain('GPT-5.5') // real run top entry
  expect(html).not.toContain('DEMO MODE') // no placeholder banner on real data
  expect((html.match(/score-row/g) ?? []).length).toBeGreaterThanOrEqual(20)
})

test('rows carry per-prompt bars and best-cat images without JS', () => {
  expect(html).toContain('class="bar"')
  expect(html).toContain('/run/svg/')
  expect(html).toContain('<details') // expandable rows are native details
})

test('model pages exist with all samples and lightboxes', () => {
  const model = readFileSync(join(SITE, 'dist', 'models', 'openai__gpt-5.5', 'index.html'), 'utf8')
  expect(model).toContain('GPT-5.5')
  expect((model.match(/class="cat-card"/g) ?? []).length).toBeGreaterThanOrEqual(20)
  expect(model).toContain('class="lightbox"') // :target lightbox, no JS
  expect(model).toContain('astro-code synthwave-84') // Shiki-highlighted SVG source present
  // Shiki tokenizes `<svg` into adjacent spans and escapes `<` as a numeric entity, not `&lt;`
  expect(model).toMatch(/&#x3C;<\/span><span[^>]*>svg/)
})

test('gallery ships the filter panel and a card per valid cat', () => {
  const gallery = readFileSync(join(SITE, 'dist', 'gallery', 'index.html'), 'utf8')
  expect(gallery).toContain('id="gallery-filters"')
  expect(gallery).toContain('id="f-search"')
  for (const p of ['minimal', 'realistic', 'action', 'style', 'constraint', 'animation']) {
    expect(gallery).toContain(`data-prompt="${p}"`)
  }
  expect((gallery.match(/class="cat-card"/g) ?? []).length).toBeGreaterThanOrEqual(200)
  // cards deep-link to model pages (no-JS fallback) instead of embedding lightboxes
  expect((gallery.match(/class="lightbox"/g) ?? []).length).toBe(1) // just the shared quick-view
  expect(gallery).not.toContain('astro-code') // no Shiki blocks on the gallery anymore
})

test('filter-hidden cards are actually display:none in the compiled CSS', () => {
  // Regression: `.cat-card { display: block }` outranks the UA `[hidden]` rule,
  // so filtering set the property but nothing visually disappeared. A rule at
  // least as specific as .cat-card must force the hide. Astro minifies CSS.
  const cssDir = join(SITE, 'dist', '_astro')
  const css = readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(cssDir, f), 'utf8'))
    .join('')
  expect(css).toMatch(/\.cat-card\[hidden\]\s*\{\s*display:\s*none/)
})

test('hall of shame shows lowest scores and did-not-finish cards', () => {
  const shame = readFileSync(join(SITE, 'dist', 'shame', 'index.html'), 'utf8')
  expect(shame).toContain('LOWEST SURVIVING SCORES')
  expect(shame).toContain('DID NOT FINISH') // the real run's failed-validation samples
  expect(shame).toContain('GAME OVER')
})

test('arena page ships the fighter manifest and offline fallback', () => {
  const arena = readFileSync(join(SITE, 'dist', 'arena', 'index.html'), 'utf8')
  expect(arena).toContain('CAT FIGHT')
  expect(arena).toContain('id="fighter-manifest"')
  expect(arena).toContain('ARCADE OFFLINE')
})

test('every page ships brand meta, icons, and the sound toggle', () => {
  expect(html).toContain('href="/favicon.svg"')
  expect(html).toContain('rel="apple-touch-icon"')
  expect(html).toContain('content="https://meowbench.com/og/meowbench-og.png"')
  expect(html).toContain('name="twitter:card"')
  expect(html).toContain('id="sound-toggle"')
  for (const f of ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'site.webmanifest', 'og/meowbench-og.png', 'icons/icon-512.png']) {
    expect(existsSync(join(SITE, 'dist', f)), f).toBe(true)
  }
  // messenger preview fetchers reject heavyweight cards; keep it well under 300KB
  expect(readFileSync(join(SITE, 'dist', 'og', 'meowbench-og.png')).length).toBeLessThan(300_000)
})

test('the site is generative-AI ready: robots.txt, llms.txt, sitemap, JSON-LD', () => {
  const robots = readFileSync(join(SITE, 'dist', 'robots.txt'), 'utf8')
  expect(robots).toContain('User-agent: GPTBot')
  expect(robots).toContain('User-agent: ClaudeBot')
  expect(robots).toContain('User-agent: PerplexityBot')
  expect(robots).not.toContain('Disallow') // no bars — everything is welcome
  expect(robots).toContain('Sitemap: https://meowbench.com/sitemap.xml')

  const llms = readFileSync(join(SITE, 'dist', 'llms.txt'), 'utf8')
  expect(llms).toContain('# meowbench')
  expect(llms).toContain('GPT-5.5') // real leaderboard inline
  expect(llms).toContain('https://meowbench.com/methodology/')

  const sitemap = readFileSync(join(SITE, 'dist', 'sitemap.xml'), 'utf8')
  expect(sitemap).toContain('<loc>https://meowbench.com/</loc>')
  expect(sitemap).toContain('/models/openai__gpt-5.5/')
  expect((sitemap.match(/<loc>/g) ?? []).length).toBeGreaterThanOrEqual(34)

  expect(html).toContain('"@type":"Dataset"') // schema.org JSON-LD on the home page
})

test('footer credits Adnan and the star nudge is bundled', () => {
  expect(html).toMatch(/by <a href="https:\/\/github\.com\/adoistic">Adnan<\/a>/)
  const js = readdirSync(join(SITE, 'dist', '_astro'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(SITE, 'dist', '_astro', f), 'utf8'))
    .join('')
  expect(js).toContain('star-nudge')
  expect(js).toContain('meow-star-done')
})

test('consent-first analytics: banner code, privacy page, footer controls', () => {
  // the consent machinery ships (inert without PUBLIC_GA_ID at build time)
  const js = readdirSync(join(SITE, 'dist', '_astro'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(SITE, 'dist', '_astro', f), 'utf8'))
    .join('')
  expect(js).toContain('meow-consent')
  expect(js).toContain('INSERT COOKIE?')
  expect(js).toContain('googletagmanager.com/gtag/js')

  const privacy = readFileSync(join(SITE, 'dist', 'privacy', 'index.html'), 'utf8')
  expect(privacy).toContain('Google Analytics')
  expect(privacy).toContain('consent (GDPR art. 6(1)(a))')
  expect(privacy).toContain('salted hash')

  expect(html).toContain('id="cookie-settings"') // footer: change your mind anywhere
  const sitemap = readFileSync(join(SITE, 'dist', 'sitemap.xml'), 'utf8')
  expect(sitemap).toContain('/privacy/')
})

test('paw cursors and the neko ship on every page', () => {
  for (const f of ['cursors/paw.png', 'cursors/paw-point.png']) {
    expect(existsSync(join(SITE, 'dist', f)), f).toBe(true)
  }
  const cssDir = join(SITE, 'dist', '_astro')
  const css = readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(cssDir, f), 'utf8'))
    .join('')
  expect(css).toContain("cursor:url(/cursors/paw.png)")
  expect(css).toContain("cursor:url(/cursors/paw-point.png)")
  const js = readdirSync(cssDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(cssDir, f), 'utf8'))
    .join('')
  expect(js).toContain('meow-cat') // the chasing neko is bundled
})

test('view transitions keep the audio engine alive across navigation', () => {
  // ClientRouter enables SPA navigation so the AudioContext (and running music)
  // survives page changes instead of restarting on every load.
  expect(html).toContain('astro-view-transitions-enabled')
  // the sound toggle persists across the swap so its state/animation don't flash
  expect(html).toMatch(/id="sound-toggle"[^>]*data-astro-transition-persist/)
  // page scripts must re-wire on astro:page-load, or they'd break on back-nav
  const js = readdirSync(join(SITE, 'dist', '_astro'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(SITE, 'dist', '_astro', f), 'utf8'))
    .join('')
  expect(js).toContain('astro:page-load')
})

test('methodology documents the full protocol', () => {
  const m = readFileSync(join(SITE, 'dist', 'methodology', 'index.html'), 'utf8')
  for (const s of ['meowscore', 'K=32', 'OpenRouter', 'resvg', 'prompt_fidelity', 'rate limit']) {
    expect(m.toLowerCase()).toContain(s.toLowerCase())
  }
})
