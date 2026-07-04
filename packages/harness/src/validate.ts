import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { ValidationResult } from './types.js'

const MAX_BYTES = 500_000
const FORBIDDEN_TAGS = new Set(['script', 'foreignobject'])

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
  if (XMLValidator.validate(svg) !== true) return { valid: false, reasons: ['not-xml'], stats: null }

  const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, attributeNamePrefix: '@_' })
  const roots = toNodes(parser.parse(svg) as Record<string, unknown>[])
  const root = roots.find((n) => !n.tag.startsWith('?') && !n.tag.startsWith('!'))
  if (!root || root.tag !== 'svg') return { valid: false, reasons: ['root-not-svg'], stats: null }

  const reasons = new Set<string>()
  const colors = new Set<string>()
  let elements = 0
  let paths = 0

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
