// /sitemap.xml — hand-rolled: the route set is small and fully known at build
// time (static pages + one page per model in the run), so no integration needed.
import type { APIRoute } from 'astro'
import { loadRun } from '../lib/run-data'
import { modelDir } from '../lib/slug'

export const GET: APIRoute = ({ site }) => {
  const run = loadRun()
  const base = site ?? new URL('https://meowbench.com')
  const u = (p: string) => new URL(p, base).href

  const paths = [
    '/',
    '/gallery/',
    '/arena/',
    '/shame/',
    '/methodology/',
    '/privacy/',
    ...run.entries.map((e) => `/models/${modelDir(e.slug)}/`),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${u(p)}</loc></url>`).join('\n')}
</urlset>
`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
