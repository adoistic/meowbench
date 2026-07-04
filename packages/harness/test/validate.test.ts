import { expect, test } from 'vitest'
import { validateSvg } from '../src/validate.js'

const OK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <path d="M0 0 L5 5" fill="#f80" stroke="black"/>
  <circle r="3" fill="#F80"/>
</svg>`

test('accepts a clean svg and reports stats', () => {
  const r = validateSvg(OK)
  expect(r.valid).toBe(true)
  expect(r.reasons).toEqual([])
  expect(r.stats).toMatchObject({ elements: 3, paths: 1 })
  expect(r.stats!.colors).toEqual(['#f80', 'black']) // case-folded, deduped, sorted
})

test('rejects malformed xml', () => {
  const r = validateSvg('<svg><circle</svg>')
  expect(r.valid).toBe(false)
  expect(r.reasons).toContain('not-xml')
})

test('rejects non-svg root', () => {
  expect(validateSvg('<html><svg/></html>').reasons).toContain('root-not-svg')
})

test('rejects embedded raster images', () => {
  const r = validateSvg('<svg><image href="data:image/png;base64,AAAA"/></svg>')
  expect(r.valid).toBe(false)
  expect(r.reasons).toContain('raster-image')
})

test('rejects scripts, event handlers, and external refs', () => {
  expect(validateSvg('<svg><script>alert(1)</script></svg>').reasons).toContain('forbidden-tag:script')
  expect(validateSvg('<svg onload="x()"><rect/></svg>').reasons).toContain('script-attr')
  expect(validateSvg('<svg><use href="https://evil.example/x.svg#a"/></svg>').reasons).toContain('external-ref')
})

test('rejects oversized documents', () => {
  const fat = `<svg>${'<rect/>'.repeat(80_000)}</svg>`
  expect(validateSvg(fat).reasons).toContain('too-large')
})

test('never throws on degenerate input, returns parse-error', () => {
  const deep = '<svg>' + '<g>'.repeat(60_000) + '</g>'.repeat(60_000) + '</svg>'
  const r = validateSvg(deep)
  expect(r.valid).toBe(false)
  expect(r.reasons.length).toBeGreaterThan(0) // parse-error or too-large, must not throw
})

test('rejects doctype declarations (entity smuggling)', () => {
  const sneaky = '<!DOCTYPE svg [<!ENTITY p "https:"><!ENTITY u "&p;//evil.example/x.svg#a">]><svg><use href="&u;"/></svg>'
  expect(validateSvg(sneaky).reasons).toContain('doctype')
})

test('allows benign legacy doctype without internal subset', () => {
  const legacy = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg><rect fill="tan"/></svg>'
  const r = validateSvg(legacy)
  expect(r.reasons).not.toContain('doctype')
  expect(r.valid).toBe(true)
})

test('rejects css url() refs in style attrs and style elements', () => {
  expect(validateSvg('<svg><rect style="fill:url(https://evil.com/x.png)"/></svg>').reasons).toContain('css-url')
  expect(validateSvg('<svg><style>@import url(https://evil.com/a.css);</style></svg>').reasons).toContain('css-url')
})

test('case tricks are caught (regression)', () => {
  expect(validateSvg('<svg><SCRIPT>alert(1)</SCRIPT></svg>').reasons).toContain('forbidden-tag:script')
  expect(validateSvg('<svg><ForeignObject/></svg>').reasons).toContain('forbidden-tag:foreignobject')
})
