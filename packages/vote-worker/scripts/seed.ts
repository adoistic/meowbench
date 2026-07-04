import { readFileSync } from 'node:fs'

export interface ScoreRow {
  modelSlug: string
  promptId: string
  sample: number
  valid: boolean
}

function esc(s: string): string {
  return s.replaceAll("'", "''")
}

/**
 * Emit idempotent INSERTs seeding both the entrants manifest and one standings
 * row per distinct model, from valid scored samples. The standings rows (rating
 * defaults to 1500 per the schema) ensure every model shows on the leaderboard's
 * Crowd Score column immediately, before it has received any votes.
 */
export function seedSql(scores: ScoreRow[]): string {
  const valid = scores.filter((s) => s.valid)
  const entrantLines = valid.map((s) => {
    const id = `${s.modelSlug}|${s.promptId}|${s.sample}`
    return `INSERT OR IGNORE INTO entrants (sample_id, model_slug, prompt_id) VALUES ('${esc(id)}', '${esc(s.modelSlug)}', '${esc(s.promptId)}');`
  })
  const models = [...new Set(valid.map((s) => s.modelSlug))]
  const standingLines = models.map(
    (m) => `INSERT OR IGNORE INTO standings (model_slug) VALUES ('${esc(m)}');`,
  )
  return [...entrantLines, ...standingLines].join('\n') + '\n'
}

// CLI: tsx scripts/seed.ts <path-to-scores.json>  > seed.sql
if (process.argv[1]?.endsWith('seed.ts')) {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: seed.ts <scores.json>')
    process.exit(1)
  }
  const scores = JSON.parse(readFileSync(path, 'utf8')) as ScoreRow[]
  process.stdout.write(seedSql(scores))
}
