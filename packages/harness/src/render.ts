import { Resvg } from '@resvg/resvg-js'

const TARGET_WIDTH = 800
// Cap the output raster so degenerate aspect ratios (e.g. viewBox="0 0 1 100000",
// which would raster to 800x80M px and OOM) throw instead of hanging the run.
const MAX_HEIGHT = 4000

/** Deterministic 800px-wide render on white; throws if the SVG cannot render safely. */
export function renderSvgToPng(svg: string): Buffer {
  // resvg silently ignores a degenerate viewBox (e.g. "0 0 0 0") and falls back to a
  // 100x100 default, so the probe below never reports zero — check the attribute directly.
  const viewBox = /<svg[^>]*\bviewBox\s*=\s*(["'])([^"']*)\1/.exec(svg)
  if (viewBox) {
    const raw = viewBox[2]
    const parts = raw.trim().split(/[\s,]+/).map(Number)
    if (parts.length !== 4 || parts.some(Number.isNaN) || !(parts[2] > 0) || !(parts[3] > 0)) {
      throw new Error(`degenerate-viewbox: ${raw}`)
    }
  }
  const probe = new Resvg(svg)
  const { width, height } = probe
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`degenerate-dimensions: ${width}x${height}`)
  }
  const scaledHeight = (TARGET_WIDTH * height) / width
  if (scaledHeight > MAX_HEIGHT) {
    throw new Error(`render-too-tall: ${Math.round(scaledHeight)}px at ${TARGET_WIDTH}px width`)
  }
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: TARGET_WIDTH },
    background: 'white',
  })
  return Buffer.from(resvg.render().asPng())
}
