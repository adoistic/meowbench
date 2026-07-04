export interface PromptSpec {
  id: string
  title: string
  user: string
}

export interface PromptSuite {
  version: number
  system: string
  prompts: PromptSpec[]
}

export interface ModelSpec {
  slug: string // OpenRouter slug, e.g. "openai/gpt-4o"
  name: string
  era: 'legacy' | 'previous' | 'current'
  origin: string // e.g. "US", "CN", "FR"
  license: 'open' | 'closed'
}

export type SampleStatus = 'ok' | 'refusal' | 'no-svg' | 'error'

export interface GenerationRecord {
  modelSlug: string
  promptId: string
  sample: number // 1-based
  status: SampleStatus
  temperature: number
  rawPath: string // relative to run dir
  svgPath?: string
}

export interface SvgStats {
  bytes: number
  elements: number
  paths: number
  colors: string[]
}

export interface ValidationResult {
  valid: boolean
  reasons: string[]
  stats: SvgStats | null
}

export const RUBRIC_AXES = ['cat_likeness', 'aesthetic', 'technique', 'prompt_fidelity'] as const
export type RubricAxis = (typeof RUBRIC_AXES)[number]
export type AxisScores = Record<RubricAxis, number>

export interface Judgment {
  judgeSlug: string
  scores: AxisScores
}

export interface SampleScore {
  modelSlug: string
  promptId: string
  sample: number
  valid: boolean
  axisMedians: AxisScores | null
  score: number // 0-10; 0 when invalid/refused
}

export interface LeaderboardEntry {
  slug: string
  name: string
  era: ModelSpec['era']
  origin: string
  license: ModelSpec['license']
  meowscore: number // 0-100
  perPrompt: Record<string, { median: number; best: number }>
  refusalRate: number // 0-1 over all samples
  avgElements: number | null
}

export interface Leaderboard {
  suiteVersion: number
  runId: string
  entries: LeaderboardEntry[] // sorted by meowscore desc
}
