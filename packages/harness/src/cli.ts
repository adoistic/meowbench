import { Command } from 'commander'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModels, loadSuite } from './config.js'
import { estimateRun } from './estimate.js'
import { CannedClient } from './fake-client.js'
import { OpenRouterClient, type ChatClient } from './openrouter.js'
import { compileRun } from './stages/compile.js'
import { runGenerate } from './stages/generate.js'
import { runJudge } from './stages/judge.js'
import { runRender } from './stages/render.js'
import { runValidate } from './stages/validate.js'

export interface RunAllOpts {
  runDir: string
  modelsPath: string
  promptsPath: string
  samples: number
  judgeSlugs: string[]
  dryRun: boolean
  apiKey?: string
  log?: (line: string) => void
}

export async function runAll(opts: RunAllOpts): Promise<void> {
  const { runDir, samples, judgeSlugs, log = console.log } = opts
  const models = loadModels(opts.modelsPath)
  const suite = loadSuite(opts.promptsPath)

  let client: ChatClient
  if (opts.dryRun) {
    client = new CannedClient()
  } else {
    const key = opts.apiKey ?? process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY is not set (or pass --dry-run)')
    client = new OpenRouterClient(key)
  }

  const records = await runGenerate({ runDir, models, suite, samples, client, log })
  const validations = runValidate(runDir, records)
  const rendered = runRender(runDir, records, validations)
  log(`rendered ${rendered} pngs`)
  const judged = await runJudge({ runDir, records, validations, suite, judgeSlugs, client, log })
  log(`judged ${judged} samples`)
  const { leaderboard } = compileRun({ runDir, records, validations, suite, models, runId: basename(runDir) })
  log(`leaderboard: ${leaderboard.entries.map((e) => `${e.name}=${e.meowscore}`).join('  ')}`)
}

// Resolve default config paths from the repo root, not cwd — under `pnpm -F`
// the cwd is packages/harness/, where models.json/prompts/ don't exist.
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

/** Parse and validate --samples; throws on non-positive-integer input. */
export function parseSamples(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) throw new Error(`--samples must be a positive integer, got ${raw}`)
  return n
}

const program = new Command()
program.name('meowbench').description('Which AI draws the best cat as an SVG?')

program
  .command('run')
  .requiredOption('--run-dir <dir>', 'run folder, e.g. runs/2026-07-04_run-001')
  .option('--models <path>', 'models.json', join(REPO_ROOT, 'models.json'))
  .option('--prompts <path>', 'prompts json', join(REPO_ROOT, 'prompts/prompts.json'))
  .option('--samples <n>', 'samples per model x prompt', '4')
  .option('--judges <slugs>', 'comma-separated judge slugs', '')
  .option('--dry-run', 'offline canned client', false)
  .option('--estimate', 'print projected calls/cost and exit', false)
  .option('-y, --yes', 'confirm a real paid run', false)
  .action(async (o: Record<string, string | boolean>) => {
    const models = loadModels(String(o.models))
    const suite = loadSuite(String(o.prompts))
    const judgeSlugs = String(o.judges).split(',').filter(Boolean)
    const samples = parseSamples(String(o.samples))
    if (o.estimate) {
      const est = estimateRun({
        modelCount: models.length, promptCount: suite.prompts.length,
        samples, judgeCount: judgeSlugs.length || 3,
      })
      console.log(`generations: ${est.generations}\nmax judge calls: ${est.maxJudgeCalls}\nrough cost: ~$${est.roughUsd}`)
      return
    }
    if (!o.dryRun && judgeSlugs.length !== 3) throw new Error('exactly 3 --judges required for a real run')
    if (!o.dryRun) {
      const est = estimateRun({
        modelCount: models.length, promptCount: suite.prompts.length, samples, judgeCount: judgeSlugs.length,
      })
      console.log(`This run will make ~${est.generations} generations + up to ${est.maxJudgeCalls} judge calls (~$${est.roughUsd}).`)
      if (!o.yes) throw new Error('refusing to start a paid run without --yes (or use --dry-run / --estimate first)')
    }
    await runAll({
      runDir: String(o.runDir), modelsPath: String(o.models), promptsPath: String(o.prompts),
      samples, judgeSlugs: judgeSlugs.length ? judgeSlugs : ['judge/a', 'judge/b', 'judge/c'],
      dryRun: Boolean(o.dryRun),
    })
  })

// Only parse argv when executed directly, not when imported by tests.
if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('meowbench')) {
  program.parseAsync().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
