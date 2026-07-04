import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { ValidationResult } from './types.js'

/**
 * Deliberate v1 limitations (downstream is resvg rasterization only,
 * never a browser):
 * - Colors and refs inside CSS class rules are not fully parsed; any
 *   url(...) in style attrs or <style> blocks is rejected wholesale
 *   instead of being resolved.
 * - SMIL animation tags (<animate> etc.) are allowed since resvg never
 *   executes them.
 * - javascript: hrefs are unchecked because nothing downstream executes
 *   scripts or follows link navigation.
 */

const MAX_BYTES = 500_000
const FORBIDDEN_TAGS = new Set(['script', 'foreignobject'])
const CSS_URL = /url\s*\(/i

interface Node {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}

function toNodes(parsed: Record<string, unknown>[]): Node[] {
  const nodes: Node[] = []
  for (const item of parsed) {
    const tag = Object.keys(item).find((k) => k !== ':@')
    if (!tag || tag === '#text' || tag === '#comment') continue
    const attrs: Record<string, string> = {}
    for (const [k, v] of Object.entries((item[':@'] as Record<string, unknown>) ?? {})) {
      attrs[k.replace(/^@_/, '').toLowerCase()] = String(v)
    }
    nodes.push({ tag: tag.toLowerCase(), attrs, children: toNodes(item[tag] as Record<string, unknown>[]) })
  }
  return nodes
}

function* walk(nodes: Node[]): Generator<Node> {
  for (const n of nodes) {
    yield n
    yield* walk(n.children)
  }
}

export function validateSvg(svg: string): ValidationResult {
  const bytes = Buffer.byteLength(svg, 'utf8')
  if (bytes > MAX_BYTES) return { valid: false, reasons: ['too-large'], stats: null }
  // DTDs allow entity indirection that can smuggle external refs past
  // attribute checks; legit cat SVGs never need a DOCTYPE.
  if (/<!doctype/i.test(svg)) return { valid: false, reasons: ['doctype'], stats: null }
  if (XMLValidator.validate(svg) !== true) return { valid: false, reasons: ['not-xml'], stats: null }

  let root: Node | undefined
  try {
    const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, attributeNamePrefix: '@_' })
    const roots = toNodes(parser.parse(svg) as Record<string, unknown>[])
    root = roots.find((n) => !n.tag.startsWith('?') && !n.tag.startsWith('!'))
  } catch {
    // e.g. fast-xml-parser "Maximum nested tags exceeded" on degenerate
    // input; the validator must never throw on arbitrary model output.
    return { valid: false, reasons: ['parse-error'], stats: null }
  }
  if (!root || root.tag !== 'svg') return { valid: false, reasons: ['root-not-svg'], stats: null }

  const reasons = new Set<string>()
  const colors = new Set<string>()
  let elements = 0
  let paths = 0

  // <style> blocks are checked on the raw string since the parser folds
  // their text content away from the attribute view we walk below.
  for (const block of svg.match(/<style[\s\S]*?<\/style>/gi) ?? []) {
    if (CSS_URL.test(block)) reasons.add('css-url')
  }

  for (const node of walk([root])) {
    elements++
    if (node.tag === 'path') paths++
    if (FORBIDDEN_TAGS.has(node.tag)) reasons.add(`forbidden-tag:${node.tag}`)
    if (node.tag === 'image') reasons.add('raster-image')
    const href = node.attrs['href'] ?? node.attrs['xlink:href'] ?? ''
    if (/^https?:/i.test(href)) reasons.add('external-ref')
    for (const key of Object.keys(node.attrs)) {
      if (key.startsWith('on')) reasons.add('script-attr')
    }
    const style = node.attrs['style']
    if (style && CSS_URL.test(style)) reasons.add('css-url')
    for (const key of ['fill', 'stroke'] as const) {
      const v = node.attrs[key]?.toLowerCase()
      if (v && v !== 'none') colors.add(v)
    }
  }

  return {
    valid: reasons.size === 0,
    reasons: [...reasons],
    stats: { bytes, elements, paths, colors: [...colors].sort() },
  }
}
