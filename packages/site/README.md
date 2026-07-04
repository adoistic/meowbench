# @meowbench/site

The meowbench arcade. Astro static site, deployed to Cloudflare Pages.

## Develop

```
pnpm -F @meowbench/site dev        # dev server against the latest run in runs/
pnpm -F @meowbench/site test       # data-layer + build-output tests
pnpm -F @meowbench/site build      # prebuild syncs renders into public/run/
```

## Data

The site builds from the lexically-latest `runs/<id>/` containing a leaderboard.json.
Override with `MEOWBENCH_RUN=<run-id>`. The committed `2026-07-04_dev-fixture` run is
synthetic demo data; the home page shows a DEMO MODE banner while it's the latest run —
the banner disappears automatically when a real run lands.

## Deploy (Cloudflare Pages)

1. Pages project → connect the repo, build command `pnpm -F @meowbench/site build`,
   output dir `packages/site/dist`, root `/`.
2. Env var `PUBLIC_VOTE_API` = the deployed vote worker origin
   (e.g. `https://meowbench-vote.<account>.workers.dev`). Leave unset to run the site
   with the arena in offline mode (playable, votes not recorded).
3. New benchmark run: commit the run folder, redeploy. Re-seed the vote worker
   (see the vote-worker plan's runbook) so the arena manifest matches the new samples.
