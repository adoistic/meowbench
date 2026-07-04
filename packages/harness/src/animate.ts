import { chromium } from 'playwright'

/** Render the SVG in Chromium, screenshot at 0/500/1000ms; motion = any frame differs. */
export async function checkMotion(svg: string): Promise<boolean> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
    await page.setContent(`<body style="margin:0">${svg}</body>`)
    const frames: Buffer[] = []
    for (let i = 0; i < 3; i++) {
      frames.push(await page.screenshot())
      if (i < 2) await page.waitForTimeout(500)
    }
    return !frames[0].equals(frames[1]) || !frames[1].equals(frames[2])
  } finally {
    await browser.close()
  }
}
