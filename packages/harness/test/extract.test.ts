import { expect, test } from 'vitest'
import { extractSvg } from '../src/extract.js'

const CAT = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'

test('extracts bare svg', () => {
  expect(extractSvg(CAT)).toBe(CAT)
})

test('extracts svg from markdown fence with prose around it', () => {
  const reply = 'Here is your cat!\n```svg\n' + CAT + '\n```\nEnjoy!'
  expect(extractSvg(reply)).toBe(CAT)
})

test('spans first <svg to last </svg> when nested/multiple', () => {
  const reply = CAT + '\n' + CAT
  const out = extractSvg(reply)
  expect(out?.startsWith('<svg')).toBe(true)
  expect(out?.endsWith('</svg>')).toBe(true)
  expect(out).toContain('\n')
})

test('returns null when no svg present', () => {
  expect(extractSvg('I cannot draw cats, sorry.')).toBeNull()
  expect(extractSvg('</svg> before <svg')).toBeNull()
})

test('extracts self-closing svg root', () => {
  expect(extractSvg('here: <svg viewBox="0 0 10 10"/> done')).toBe('<svg viewBox="0 0 10 10"/>')
  expect(extractSvg('<svg/>')).toBe('<svg/>')
})

test('prefers paired close tag over self-closing fallback', () => {
  const doc = '<svg viewBox="0 0 5 5"><rect/></svg>'
  expect(extractSvg('x ' + doc + ' y')).toBe(doc)
})
