-- Manifest: every valid rendered sample eligible to appear in the arena.
-- Seeded at deploy from a harness run's scores.json.
CREATE TABLE entrants (
  sample_id  TEXT PRIMARY KEY,   -- "<modelSlug>|<promptId>|<sample>"
  model_slug TEXT NOT NULL,
  prompt_id  TEXT NOT NULL
);
CREATE INDEX idx_entrants_prompt ON entrants (prompt_id);

-- Per-model Elo. One row per model that has at least one entrant.
CREATE TABLE standings (
  model_slug TEXT PRIMARY KEY,
  rating     REAL NOT NULL DEFAULT 1500,
  games      INTEGER NOT NULL DEFAULT 0,
  wins       INTEGER NOT NULL DEFAULT 0,
  losses     INTEGER NOT NULL DEFAULT 0
);

-- Raw audit log of every accepted vote.
CREATE TABLE votes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,   -- epoch ms
  ip_hash       TEXT NOT NULL,      -- SHA-256(ip + salt), hex
  prompt_id     TEXT NOT NULL,
  winner_sample TEXT NOT NULL,
  loser_sample  TEXT NOT NULL,
  winner_model  TEXT NOT NULL,
  loser_model   TEXT NOT NULL
);
CREATE INDEX idx_votes_ip_ts ON votes (ip_hash, ts);
