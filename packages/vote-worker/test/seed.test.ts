import { expect, test } from 'vitest'
import { seedSql } from '../scripts/seed.js'

const SCORES = [
  { modelSlug: 'openai/gpt-4o', promptId: 'action', sample: 1, valid: true },
  { modelSlug: 'openai/gpt-4o', promptId: 'action', sample: 2, valid: false }, // invalid — skipped
  { modelSlug: 'openai/gpt-4o', promptId: 'minimal', sample: 1, valid: true },  // same model, 2nd entrant
  { modelSlug: 'qwen/qwen-2.5-72b-instruct', promptId: 'minimal', sample: 1, valid: true },
]

test('seedSql emits one entrants INSERT per valid sample and escapes quotes', () => {
  const sql = seedSql(SCORES)
  expect(sql).toContain("INSERT OR IGNORE INTO entrants (sample_id, model_slug, prompt_id) VALUES ('openai/gpt-4o|action|1', 'openai/gpt-4o', 'action');")
  expect(sql).toContain("'qwen/qwen-2.5-72b-instruct|minimal|1'")
  expect(sql).not.toContain('action|2') // invalid sample excluded
  const entrantLines = sql.trim().split('\n').filter((l) => l.includes('INTO entrants'))
  expect(entrantLines).toHaveLength(3) // 3 valid samples
})

test('seedSql seeds one standings row per distinct model (rating defaults to 1500)', () => {
  const sql = seedSql(SCORES)
  expect(sql).toContain("INSERT OR IGNORE INTO standings (model_slug) VALUES ('openai/gpt-4o');")
  expect(sql).toContain("INSERT OR IGNORE INTO standings (model_slug) VALUES ('qwen/qwen-2.5-72b-instruct');")
  const standingLines = sql.trim().split('\n').filter((l) => l.includes('INTO standings'))
  expect(standingLines).toHaveLength(2) // 2 distinct models, deduped (gpt-4o appears once despite 2 entrants)
})

test('seedSql escapes single quotes in ids', () => {
  const sql = seedSql([{ modelSlug: "o'hare/m", promptId: 'p', sample: 1, valid: true }])
  expect(sql).toContain("o''hare/m|p|1")
  expect(sql).toContain("INSERT OR IGNORE INTO standings (model_slug) VALUES ('o''hare/m');")
})
