// preview-sprites.ts — dev-only contact sheet for the neko sprites.
// Renders every frame (plus mirrored run frames) at 8x on both the void and a
// white card background, so the pixel art can be eyeballed before it ships.
//
//   pnpm -F @meowbench/site exec tsx scripts/preview-sprites.ts <out.png>

import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
import { FRAMES, PALETTE, SIZE } from '../src/scripts/arcade-cat-sprites.js'

const CELL = 8
const PAD = 16
const LABEL_H = 0 // labels drawn as title attr only; keep the sheet clean

function frameRects(rows: string[], x0: number, y0: number, mirror = false): string {
  const out: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) {
      const ch = row[mirror ? SIZE - 1 - x : x]
      const color = PALETTE[ch]
      if (!color) continue
      out.push(`<rect x="${x0 + x * CELL}" y="${y0 + y * CELL}" width="${CELL}" height="${CELL}" fill="${color}"/>`)
    }
  })
  return out.join('')
}

const entries = Object.entries(FRAMES)
// add mirrored variants of the run frames (left-facing) to check both ways
entries.push(['run_a ←', FRAMES.run_a], ['run_b ←', FRAMES.run_b])

const cols = entries.length
const tile = SIZE * CELL
const width = PAD + cols * (tile + PAD)
const height = PAD + 2 * (tile + PAD) + LABEL_H

const parts: string[] = []
parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`) // top row: white (cat-card bg)
parts.push(`<rect y="${PAD + tile + PAD / 2}" width="${width}" height="${height}" fill="#120a26"/>`) // bottom: void

entries.forEach(([name, rows], i) => {
  const mirror = name.endsWith('←')
  const x = PAD + i * (tile + PAD)
  parts.push(frameRects(rows, x, PAD, mirror))
  parts.push(frameRects(rows, x, PAD + tile + PAD, mirror))
})

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${parts.join('')}</svg>`
const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
const out = process.argv[2] ?? 'sprite-sheet.png'
writeFileSync(out, png)
console.log(`wrote ${out} — frames: ${entries.map(([n]) => n).join(', ')}`)
