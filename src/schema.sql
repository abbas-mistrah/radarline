PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#ff681e',
  include_keywords TEXT NOT NULL DEFAULT '',
  exclude_keywords TEXT NOT NULL DEFAULT '',
  horizon TEXT NOT NULL DEFAULT 'next',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'publication',
  connector TEXT NOT NULL DEFAULT 'rss',
  url TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT 'daily',
  authority INTEGER NOT NULL DEFAULT 60,
  language TEXT NOT NULL DEFAULT 'en',
  active INTEGER NOT NULL DEFAULT 1,
  creator_name TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  last_success_at TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  items_seen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY,
  source_id INTEGER,
  external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signal_type TEXT NOT NULL DEFAULT 'OTHER',
  status TEXT NOT NULL DEFAULT 'WATCH',
  horizon TEXT NOT NULL DEFAULT 'next',
  relevance INTEGER NOT NULL DEFAULT 50,
  novelty INTEGER NOT NULL DEFAULT 50,
  authority INTEGER NOT NULL DEFAULT 50,
  corroboration INTEGER NOT NULL DEFAULT 25,
  freshness INTEGER NOT NULL DEFAULT 50,
  traceability INTEGER NOT NULL DEFAULT 50,
  uncertainty INTEGER NOT NULL DEFAULT 50,
  trace_score INTEGER NOT NULL DEFAULT 50,
  hype_gap INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 50,
  demo INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  implications_json TEXT NOT NULL DEFAULT '[]',
  claims_json TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT '',
  analyzed_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, external_id),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS signal_themes (
  signal_id INTEGER NOT NULL,
  theme_id INTEGER NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 50,
  PRIMARY KEY (signal_id, theme_id),
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS briefs (
  id INTEGER PRIMARY KEY,
  period TEXT NOT NULL DEFAULT 'daily',
  title TEXT NOT NULL,
  executive_summary TEXT NOT NULL DEFAULT '',
  body_md TEXT NOT NULL,
  signal_ids_json TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY,
  source_id INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_status_score ON signals(archived, status, trace_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_published ON signals(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_themes_theme ON signal_themes(theme_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(source_id, id DESC);
