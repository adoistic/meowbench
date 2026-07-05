// make-brand.ts — generates every brand asset from code: favicon (SVG + PNG
// sizes + ICO), apple-touch-icon, manifest icons, and the OG/social card.
//
// No design tools, no font files. The cat is a 12x12 pixel grid (same visual
// language as the nav icons) and all OG text is drawn with a hand-defined 5x7
// pixel font emitted as SVG rects — so the card renders identically everywhere
// and the PNGs stay tiny enough for WhatsApp's preview fetcher.
//
// Run once (outputs are committed):  pnpm -F @meowbench/site exec tsx scripts/make-brand.ts

import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUB = fileURLToPath(new URL('../public', import.meta.url))

// ---- palette (mirrors arcade.css tokens) ----
const VOID = '#120a26'
const YELLOW = '#ffde59'
const PINK = '#ff3d81'
const MINT = '#8affc1'
const DIM = '#8d7fc0'

// ---- the cat: 12x12 grid, Y = yellow, P = pink nose, . = transparent ----
const CAT = [
  '............',
  '.Y........Y.',
  '.YY......YY.',
  '.YYY....YYY.',
  '.YYYYYYYYYY.',
  'YYYYYYYYYYYY',
  'YY..YYYY..YY', // eyes
  'YYYYYPPYYYYY', // nose
  'YYYYYYYYYYYY',
  '.YYYYYYYYYY.',
  '..YYYYYYYY..',
  '............',
]

function catRects(cell: number, x0 = 0, y0 = 0): string {
  const out: string[] = []
  CAT.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.') continue
      out.push(
        `<rect x="${x0 + x * cell}" y="${y0 + y * cell}" width="${cell}" height="${cell}" fill="${c === 'P' ? PINK : YELLOW}"/>`,
      )
    }
  })
  return out.join('')
}

// ---- 5x7 pixel font ('X' = pixel). Enough glyphs for the brand copy. ----
const FONT: Record<string, string[]> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  '?': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.....', '..X..'],
  '·': ['.....', '.....', '.....', '..X..', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..X..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

/** Render a string in the pixel font as rects. Returns markup + width in px. */
function pixelText(text: string, cell: number, x0: number, y0: number, fill: string): { svg: string; width: number } {
  const out: string[] = []
  let cx = x0
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch]
    if (!glyph) throw new Error(`pixel font is missing glyph: "${ch}"`)
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === 'X') out.push(`<rect x="${cx + gx * cell}" y="${y0 + gy * cell}" width="${cell}" height="${cell}"/>`)
      }
    })
    cx += cell * 6 // 5 glyph cols + 1 col of spacing
  }
  return { svg: `<g fill="${fill}">${out.join('')}</g>`, width: cx - x0 - cell }
}

// ---- favicon SVG: cat on the void, rounded like a cabinet button ----
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">
<rect width="48" height="48" rx="9" fill="${VOID}"/>
${catRects(4, 0, 0)}
</svg>
`

// ---- OG card: 1200x630 ----
function ogSvg(): string {
  const parts: string[] = []
  parts.push(`<rect width="1200" height="630" fill="${VOID}"/>`)
  // faint CRT scanlines
  parts.push('<g fill="#000000" opacity="0.22">')
  for (let y = 0; y < 630; y += 5) parts.push(`<rect x="0" y="${y}" width="1200" height="2"/>`)
  parts.push('</g>')
  // marquee chase-light border: alternating yellow/pink bulbs
  parts.push('<g>')
  const inset = 26
  const gap = 44
  const bulb = 10
  const put = (x: number, y: number, i: number) =>
    parts.push(`<rect x="${x}" y="${y}" width="${bulb}" height="${bulb}" fill="${i % 2 ? PINK : YELLOW}" opacity="${i % 2 ? 0.55 : 0.95}"/>`)
  let i = 0
  for (let x = inset; x <= 1200 - inset - bulb; x += gap) put(x, inset, i++)
  for (let y = inset + gap; y <= 630 - inset - bulb; y += gap) put(1200 - inset - bulb, y, i++)
  for (let x = 1200 - inset - bulb - gap; x >= inset; x -= gap) put(x, 630 - inset - bulb, i++)
  for (let y = 630 - inset - bulb - gap; y >= inset + gap; y -= gap) put(inset, y, i++)
  parts.push('</g>')
  // the cat, big, right side, with a soft yellow glow behind it
  parts.push(`<g filter="url(#glow)" opacity="0.5">${catRects(19, 872, 158)}</g>`)
  parts.push(catRects(19, 872, 158))
  // title with glow
  const title = pixelText('MEOWBENCH', 14, 84, 130, YELLOW)
  parts.push(`<g filter="url(#glow)" opacity="0.7">${title.svg}</g>`)
  parts.push(title.svg)
  // tagline + stats
  parts.push(pixelText('WHICH AI DRAWS', 8, 84, 292, MINT).svg)
  parts.push(pixelText('THE BEST CAT?', 8, 84, 372, MINT).svg)
  parts.push(pixelText('29 MODELS · 675 CATS · 1 CHAMPION', 4, 84, 486, PINK).svg)
  parts.push(pixelText('MEOWBENCH.COM', 3, 84, 550, DIM).svg)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" shape-rendering="crispEdges">
<defs><filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter></defs>
${parts.join('\n')}
</svg>`
}

// ---- render helpers ----
function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng() as Buffer
}

/** Minimal ICO container embedding one PNG (valid since Vista; universal now). */
function icoFromPng(pngBuf: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6 + 16)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count
  header.writeUInt8(size === 256 ? 0 : size, 6) // width
  header.writeUInt8(size === 256 ? 0 : size, 7) // height
  header.writeUInt8(0, 8) // palette
  header.writeUInt8(0, 9) // reserved
  header.writeUInt16LE(1, 10) // planes
  header.writeUInt16LE(32, 12) // bpp
  header.writeUInt32LE(pngBuf.length, 14) // bytes
  header.writeUInt32LE(22, 18) // offset
  return Buffer.concat([header, pngBuf])
}

// ---- emit everything ----
mkdirSync(join(PUB, 'icons'), { recursive: true })
mkdirSync(join(PUB, 'og'), { recursive: true })

writeFileSync(join(PUB, 'favicon.svg'), faviconSvg)
writeFileSync(join(PUB, 'favicon-32.png'), png(faviconSvg, 32))
writeFileSync(join(PUB, 'favicon.ico'), icoFromPng(png(faviconSvg, 32), 32))
writeFileSync(join(PUB, 'apple-touch-icon.png'), png(faviconSvg, 180))
writeFileSync(join(PUB, 'icons', 'icon-192.png'), png(faviconSvg, 192))
writeFileSync(join(PUB, 'icons', 'icon-512.png'), png(faviconSvg, 512))
const og = png(ogSvg(), 1200)
writeFileSync(join(PUB, 'og', 'meowbench-og.png'), og)
writeFileSync(
  join(PUB, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'meowbench',
      short_name: 'meowbench',
      description: 'Which AI draws the best cat? An unreasonably rigorous benchmark.',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: VOID,
      background_color: VOID,
      display: 'browser',
    },
    null,
    2,
  ) + '\n',
)

console.log(`og card: ${(og.length / 1024).toFixed(0)}KB (messenger limit ~300KB)`)
console.log('brand assets written to public/')
