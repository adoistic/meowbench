import { expect, test } from 'vitest'
import { renderSvgToPng } from '../src/render.js'

const CAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="orange"/></svg>'

test('renders svg to an 800px PNG buffer', () => {
  const png = renderSvgToPng(CAT)
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]) // PNG magic
  expect(png.length).toBeGreaterThan(100)
})

test('throws on unrenderable input', () => {
  expect(() => renderSvgToPng('not svg at all')).toThrow()
})
