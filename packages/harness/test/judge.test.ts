import { expect, test } from 'vitest'
import { axisMedians, judgeUserContent, parseJudgeReply } from '../src/stages/judge.js'

test('parseJudgeReply reads clean and messy JSON, clamps to 0-10', () => {
  expect(parseJudgeReply('{"cat_likeness":7,"aesthetic":6,"technique":8,"prompt_fidelity":7}')).toEqual({
    cat_likeness: 7, aesthetic: 6, technique: 8, prompt_fidelity: 7,
  })
  const messy = 'Sure! Here are my scores:\n{"cat_likeness": 15, "aesthetic": -2, "technique": 8.5, "prompt_fidelity": 7}\nHope that helps.'
  expect(parseJudgeReply(messy)).toEqual({ cat_likeness: 10, aesthetic: 0, technique: 8.5, prompt_fidelity: 7 })
  expect(parseJudgeReply('I refuse to judge cats.')).toBeNull()
  expect(parseJudgeReply('{"cat_likeness": 5}')).toBeNull() // missing axes
})

test('axisMedians takes per-axis median across judges', () => {
  const medians = axisMedians([
    { judgeSlug: 'a', scores: { cat_likeness: 4, aesthetic: 5, technique: 6, prompt_fidelity: 7 } },
    { judgeSlug: 'b', scores: { cat_likeness: 8, aesthetic: 5, technique: 2, prompt_fidelity: 9 } },
    { judgeSlug: 'c', scores: { cat_likeness: 6, aesthetic: 8, technique: 4, prompt_fidelity: 8 } },
  ])
  expect(medians).toEqual({ cat_likeness: 6, aesthetic: 5, technique: 4, prompt_fidelity: 8 })
})

test('judge content includes rubric, prompt text, png, and svg source', () => {
  const parts = judgeUserContent('Draw a cat riding a bicycle as an SVG.', Buffer.from('PNGDATA'), '<svg/>')
  const text = parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('\n')
  expect(text).toContain('You are judging')
  expect(text).toContain('cat riding a bicycle')
  expect(text).toContain('<svg/>')
  const img = parts.find((p) => p.type === 'image_url') as { image_url: { url: string } }
  expect(img.image_url.url).toMatch(/^data:image\/png;base64,/)
})
