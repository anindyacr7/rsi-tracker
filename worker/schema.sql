CREATE TABLE IF NOT EXISTS rsi_alerts (
  symbol TEXT PRIMARY KEY,
  first_hit_time INTEGER NOT NULL,
  first_rsi_value REAL NOT NULL,
  max_rsi_value REAL NOT NULL,
  percent_move_24h REAL NOT NULL,
  mcap_rank INTEGER,
  last_notified_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcap_cache (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
