# @meowbench/site

The meowbench arcade. Astro static site, deployed to Cloudflare Pages.

## Develop

```
pnpm -F @meowbench/site dev        # dev server against the latest run in runs/
pnpm -F @meowbench/site test       # data-layer + build-output tests
pnpm -F @meowbench/site build      # prebuild syncs renders into public/run/
```

## Data

The site builds from the newest real `runs/<id>/` containing a leaderboard.json
(directory names are `YYYY-MM-DD_*`, so newest sorts last). `resolveRunId()` in
`src/lib/run-data.ts` skips any directory whose name looks synthetic
(`fixture`, `demo`, `synthetic`, `mock`, …) and throws if no real run exists — the
site will fail its build rather than quietly serve placeholder data. Point it at a
specific run on purpose with `MEOWBENCH_RUN=<run-id>`.

The live run is `2026-07-04_run-001`: 29 models, 2023–2026, 696 samples, judged and
committed into the repo.

## Deploy (Cloudflare Pages)

1. Pages project → connect the repo, build command `pnpm -F @meowbench/site build`,
   output dir `packages/site/dist`, root `/`.
2. Env var `PUBLIC_VOTE_API` = the deployed vote worker origin
   (e.g. `https://meowbench-vote.<account>.workers.dev`). Leave unset to run the site
   with the arena in offline mode (playable, votes not recorded).
3. New benchmark run: commit the run folder, redeploy. Re-seed the vote worker
   (see the vote-worker plan's runbook) so the arena manifest matches the new samples.
