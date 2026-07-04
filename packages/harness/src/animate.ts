import { chromium } from 'playwright'

/** Render the SVG in Chromium, screenshot 4× at 0/333/667/1000ms; motion = any frame differs.
 *  Offsets are deliberately non-multiples to avoid aliasing against common animation periods
 *  (a 3-sample 0/500/1000ms scheme would miss a 0.5s- or 1s-period loop). */
export async function checkMotion(svg: string): Promise<boolean> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
    await page.setContent(`<body style="margin:0">${svg}</body>`)
    const waits = [0, 333, 334, 333] // cumulative: 0, 333, 667, 1000ms
    const frames: Buffer[] = []
    for (const wait of waits) {
      if (wait) await page.waitForTimeout(wait)
      frames.push(await page.screenshot())
    }
    const first = frames[0]
    return frames.some((f) => !f.equals(first))
  } finally {
    await browser.close()
  }
}
