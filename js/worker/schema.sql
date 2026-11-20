CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  nick TEXT NOT NULL,
  nick_lower TEXT NOT NULL UNIQUE,
  nick_changed_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  best_wave INTEGER NOT NULL DEFAULT 0,
  best_kills INTEGER NOT NULL DEFAULT 0,
  best_level INTEGER NOT NULL DEFAULT 1,
  best_time INTEGER NOT NULL DEFAULT 0,
  best_at INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_players_best ON players(best_wave DESC, best_kills DESC);
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cooldowns (
  key TEXT PRIMARY KEY,
  until INTEGER NOT NULL
);