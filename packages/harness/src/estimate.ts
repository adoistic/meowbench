export interface EstimateOpts {
  modelCount: number
  promptCount: number
  samples: number
  judgeCount: number
}

// Display-only assumptions, documented on the methodology page:
// ~2k tokens per generation at ~$5/M avg, ~1.5k tokens per judge call at ~$3/M avg.
const GEN_USD = 0.01
const JUDGE_USD = 0.005

export function estimateRun(o: EstimateOpts) {
  const generations = o.modelCount * o.promptCount * o.samples
  const maxJudgeCalls = generations * o.judgeCount
  return {
    generations,
    maxJudgeCalls,
    roughUsd: Math.round((generations * GEN_USD + maxJudgeCalls * JUDGE_USD) * 100) / 100,
  }
}
