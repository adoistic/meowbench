/** Pull an SVG document out of model output that may include prose or fences. */
export function extractSvg(text: string): string | null {
  const start = text.search(/<svg[\s/>]/i)
  if (start === -1) return null
  const end = text.toLowerCase().lastIndexOf('</svg>')
  if (end > start) return text.slice(start, end + '</svg>'.length)
  const selfClosing = text.slice(start).match(/^<svg\b[^>]*\/>/i)
  return selfClosing ? selfClosing[0] : null
}
