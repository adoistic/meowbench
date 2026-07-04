/** Pull an SVG document out of model output that may include prose or fences. */
export function extractSvg(text: string): string | null {
  const start = text.search(/<svg[\s>]/i)
  if (start === -1) return null
  const end = text.toLowerCase().lastIndexOf('</svg>')
  if (end === -1 || end < start) return null
  return text.slice(start, end + '</svg>'.length)
}
