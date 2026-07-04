import { Resvg } from '@resvg/resvg-js'

/** Deterministic 800px-wide render on white; throws if the SVG cannot render. */
export function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 800 },
    background: 'white',
  })
  return Buffer.from(resvg.render().asPng())
}
