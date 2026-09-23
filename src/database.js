'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hash } = require('./connectors');
const { similarity, scoreSignal } = require('./scoring');
const { buildBrief } = require('./brief');

const projectRoot = path.resolve(__dirname, '..');
const runtimeDirectory = path.join(projectRoot, '.data');
const demoDatabasePath = path.join(projectRoot, 'database', 'radarline-demo.sqlite');
fs.mkdirSync(runtimeDirectory, { recursive: true });
const databasePath = process.env.RADARLINE_DB || path.join(runtimeDirectory, 'radarline.sqlite');
if (!process.env.RADARLINE_DB && !fs.existsSync(databasePath) && fs.existsSync(demoDatabasePath)) {
  fs.copyFileSync(demoDatabasePath, databasePath);
}

const db = new DatabaseSync(databasePath);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function normalize(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]));
}

function normalizeRows(rows) {
  return rows.map(normalize);
}

function daysAgo(days, hour = 9) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const themeSeed = [
  ['AI Infrastructure', 'Which infrastructure shifts change cost, control or deployment speed?', '#ff681e', 'inference,gpu,chip,cloud,runtime,serving,latency,local,ollama', 'gaming', 'now'],
  ['Agentic Systems', 'Which agent capabilities are becoming reliable enough for enterprise workflows?', '#6650e5', 'agent,agentic,tool use,workflow,orchestration,approval,mcp', 'real estate', 'next'],
  ['Enterprise Adoption', 'What changes the operating model, economics or adoption curve of enterprise AI?', '#198754', 'enterprise,adoption,productivity,workflow,roi,pricing,transformation', 'consumer gadget', 'now'],
  ['Governance & Safety', 'Which rules, controls and incidents change the acceptable boundary?', '#c94035', 'governance,safety,security,privacy,regulation,policy,standard,risk', '', 'now'],
  ['Local & Sovereign AI', 'Where can small or local models replace cloud dependence without losing decision quality?', '#2d66d2', 'local,small model,edge,sovereign,open weight,on-device,offline', '', 'next']
];

const sourceSeed = [
  ['Hugging Face Blog', 'publication', 'rss', 'https://huggingface.co/blog/feed.xml', 'daily', 88, 'en', 1, '', 'Open models & tooling'],
  ['arXiv · Artificial Intelligence', 'research', 'rss', 'https://export.arxiv.org/rss/cs.AI', 'daily', 92, 'en', 1, '', 'Research'],
  ['Ollama Releases', 'repository', 'github', 'https://github.com/ollama/ollama', 'daily', 95, 'en', 1, '', 'Local AI runtime'],
  ['Hacker News · AI query', 'community', 'hackernews', 'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=artificial%20intelligence', 'hourly', 58, 'en', 1, '', 'Builder discourse'],
  ['Northstar AI Lab · demo', 'demo', 'manual', 'https://example.com/radarline-demo/lab', 'weekly', 86, 'en', 1, '', 'Demo research'],
  ['Operator Field Notes · demo', 'demo', 'manual', 'https://example.com/radarline-demo/operators', 'weekly', 72, 'en', 1, 'Demo creator network', 'Demo practitioner signals'],
  ['Policy Observatory · demo', 'demo', 'manual', 'https://example.com/radarline-demo/policy', 'weekly', 90, 'en', 1, '', 'Demo regulation'],
  ['Infrastructure Wire · demo', 'demo', 'manual', 'https://example.com/radarline-demo/infrastructure', 'daily', 82, 'en', 1, '', 'Demo infrastructure'],
  ['Creator watchlist', 'creator', 'manual', '', 'weekly', 65, 'en', 1, 'Curated creators', 'Manual links and permitted feeds']
];

const demoSignals = [
  {
    source: 5, days: 0, title: 'Compact multimodal model moves document intelligence onto standard laptops',
    type: 'MODEL_RELEASE', status: 'BRIEF', horizon: 'now', scores: [94, 88, 86, 74, 100, 100, 14, 89, 8, 91],
    excerpt: 'A fictional demonstration release shows a sub-4B multimodal model extracting tables and citations locally with a constrained JSON output.',
    summary: 'A small multimodal model can now support structured document extraction on ordinary enterprise hardware in this fictional scenario.',
    why: 'It lowers the infrastructure and privacy barrier for local document workflows while keeping evidence on-device.',
    themes: [1, 3, 5]
  },
  {
    source: 8, days: 0, title: 'Agent runtime adds auditable human approval checkpoints between tool calls',
    type: 'PRODUCT_LAUNCH', status: 'BRIEF', horizon: 'now', scores: [91, 84, 82, 79, 100, 100, 12, 88, 4, 90],
    excerpt: 'A fictional open runtime introduces typed approval gates, replayable traces and rollback points for actions with external side effects.',
    summary: 'The runtime turns human oversight into an executable control rather than a policy note.',
    why: 'This is the missing bridge between agent prototypes and governed enterprise operations.',
    themes: [2, 3, 4]
  },
  {
    source: 5, days: 1, title: 'Small-model benchmark narrows the local extraction gap on multilingual contracts',
    type: 'RESEARCH_BREAKTHROUGH', status: 'INVESTIGATE', horizon: 'next', scores: [88, 91, 86, 61, 100, 100, 20, 84, 17, 86],
    excerpt: 'A fictional benchmark reports improved multilingual entity and clause extraction for models small enough to run locally.',
    summary: 'Small models appear more credible for bounded multilingual extraction, but the result still needs independent reproduction.',
    why: 'It expands the set of enterprise use cases that can remain private and inexpensive.',
    themes: [3, 5]
  },
  {
    source: 7, days: 1, title: 'Draft enterprise guidance strengthens evidence-retention duties for AI-assisted decisions',
    type: 'REGULATION', status: 'BRIEF', horizon: 'now', scores: [96, 70, 90, 83, 100, 100, 10, 89, 0, 92],
    excerpt: 'A fictional policy draft emphasizes source lineage, human accountability and retention of material evidence behind automated recommendations.',
    summary: 'Decision-support systems would need clearer provenance and retention controls under this fictional draft.',
    why: 'It makes evidence architecture a product requirement rather than a documentation afterthought.',
    themes: [3, 4]
  },
  {
    source: 8, days: 2, title: 'Inference engine release cuts local memory use through adaptive quantization',
    type: 'INFRASTRUCTURE', status: 'INVESTIGATE', horizon: 'now', scores: [86, 78, 82, 58, 90, 100, 19, 79, 10, 82],
    excerpt: 'A fictional runtime update reduces peak memory use while preserving structured-output reliability on common workstation hardware.',
    summary: 'Local inference is becoming easier to fit within existing workplace devices.',
    why: 'Lower memory pressure improves the economics and deployability of private AI assistants.',
    themes: [1, 5]
  },
  {
    source: 6, days: 2, title: 'Creator field note: teams are replacing chatbot pilots with narrow decision workflows',
    type: 'CREATOR_INSIGHT', status: 'WATCH', horizon: 'next', scores: [79, 75, 72, 46, 90, 92, 31, 70, 11, 74],
    excerpt: 'A fictional practitioner note observes that adoption improves when AI is attached to one accountable decision and a measurable outcome.',
    summary: 'The center of gravity is shifting from general chat interfaces to specific operating decisions.',
    why: 'This supports a transformation strategy organized around workflows and value rather than tool access.',
    themes: [2, 3]
  },
  {
    source: 5, days: 3, title: 'Open-weight embedding model improves multilingual retrieval at laptop scale',
    type: 'MODEL_RELEASE', status: 'INVESTIGATE', horizon: 'next', scores: [84, 80, 86, 64, 90, 100, 18, 80, 8, 82],
    excerpt: 'A fictional release improves multilingual semantic retrieval while keeping vector generation local.',
    summary: 'Local retrieval quality may be sufficient for more multilingual knowledge workflows.',
    why: 'Embedding quality determines whether compact local RAG systems are useful or merely private.',
    themes: [1, 5]
  },
  {
    source: 7, days: 3, title: 'Agent security study maps indirect prompt injection across common connector patterns',
    type: 'SECURITY', status: 'BRIEF', horizon: 'now', scores: [97, 89, 90, 78, 90, 100, 9, 91, 0, 93],
    excerpt: 'A fictional security study documents how untrusted web content can steer agents through connectors unless instructions and evidence are isolated.',
    summary: 'Connector content must be treated as untrusted data and kept outside the agent control plane.',
    why: 'Any technology-watch agent reads hostile public content, making injection resistance foundational.',
    themes: [2, 4]
  },
  {
    source: 6, days: 4, title: 'Enterprise buyers shift from seat-based AI pricing toward outcome-linked portfolios',
    type: 'BUSINESS_MOVE', status: 'WATCH', horizon: 'next', scores: [81, 69, 72, 44, 76, 92, 35, 67, 10, 71],
    excerpt: 'A fictional market note suggests buyers are asking vendors to connect AI pricing with throughput, quality or avoided cost.',
    summary: 'Commercial models may increasingly mirror measurable business outcomes instead of generic access.',
    why: 'Transformation leaders need attribution models before procurement models make value promises contractual.',
    themes: [3]
  },
  {
    source: 5, days: 5, title: 'Research prototype detects weak signals through cross-source disagreement',
    type: 'RESEARCH_BREAKTHROUGH', status: 'WATCH', horizon: 'later', scores: [78, 94, 86, 40, 76, 100, 32, 69, 22, 73],
    excerpt: 'A fictional prototype treats disagreement between high-authority sources as a signal to investigate rather than noise to average away.',
    summary: 'Contradiction can surface emerging change before consensus forms.',
    why: 'A watch system should preserve dissent and uncertainty, not flatten them into one confident summary.',
    themes: [1, 4]
  },
  {
    source: 7, days: 6, title: 'Open protocol proposal standardizes provenance for machine-generated intelligence briefs',
    type: 'REGULATION', status: 'INVESTIGATE', horizon: 'next', scores: [90, 86, 90, 55, 76, 100, 18, 82, 9, 84],
    excerpt: 'A fictional protocol defines identifiers, source hashes, observation timestamps and uncertainty fields for generated briefs.',
    summary: 'Portable provenance contracts could make intelligence outputs easier to audit across tools.',
    why: 'It aligns with TRACE-1 and creates an interoperability opportunity.',
    themes: [3, 4]
  },
  {
    source: 8, days: 7, title: 'Capital moves toward local inference and sovereign AI infrastructure',
    type: 'FUNDING', status: 'INVESTIGATE', horizon: 'next', scores: [82, 76, 82, 52, 76, 92, 24, 74, 7, 77],
    excerpt: 'A fictional funding round illustrates investor attention moving from generic assistants to deployment infrastructure and private inference.',
    summary: 'Investment interest is following enterprise demand for controllable, lower-cost AI infrastructure.',
    why: 'Funding direction can foreshadow capability and vendor availability over the next 12–24 months.',
    themes: [1, 3, 5]
  }
];

function seedDatabase() {
  const initialized = db.prepare("SELECT value FROM settings WHERE key = 'workspace_name'").get();
  if (initialized) return;
  db.exec('BEGIN');
  try {
    const setting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    [
      ['workspace_name', 'AI Transformation Radar'],
      ['workspace_owner', 'Abbas Mistrah'],
      ['workspace_focus', 'Enterprise AI · Local AI · Agentic Systems · Governance'],
      ['protocol_version', 'TRACE-1 1.0'],
      ['demo_notice', 'Demonstration signals are fictional. Live source syncs are clearly identified.']
    ].forEach(row => setting.run(...row));

    const insertTheme = db.prepare(`INSERT INTO themes (name, question, color, include_keywords, exclude_keywords, horizon)
      VALUES (?, ?, ?, ?, ?, ?)`);
    themeSeed.forEach(row => insertTheme.run(...row));

    const insertSource = db.prepare(`INSERT INTO sources
      (name, kind, connector, url, cadence, authority, language, active, creator_name, topic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    sourceSeed.forEach(row => insertSource.run(...row));

    const insertSignal = db.prepare(`INSERT INTO signals (
      source_id, external_id, canonical_url, title, author, excerpt, content_hash, published_at, observed_at,
      signal_type, status, horizon, relevance, novelty, authority, corroboration, freshness, traceability,
      uncertainty, trace_score, hype_gap, confidence, demo, ai_summary, why_it_matters, implications_json,
      claims_json, model, analyzed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'seeded-demo', ?)`);
    const linkTheme = db.prepare('INSERT INTO signal_themes (signal_id, theme_id, match_score) VALUES (?, ?, ?)');
    demoSignals.forEach((item, index) => {
      const published = daysAgo(item.days, 8 + (index % 7));
      const url = `https://example.com/radarline-demo/signal-${index + 1}`;
      const [relevance, novelty, authority, corroboration, freshness, traceability, uncertainty, traceScore, hypeGap, confidence] = item.scores;
      const result = insertSignal.run(
        item.source, `demo-${index + 1}`, url, item.title, 'RADARLINE demo desk', item.excerpt,
        hash(`${item.title}|${item.excerpt}`), published, published, item.type, item.status, item.horizon,
        relevance, novelty, authority, corroboration, freshness, traceability, uncertainty, traceScore,
        hypeGap, confidence, item.summary, item.why,
        JSON.stringify(['Validate against the primary source.', 'Assess impact on the active transformation roadmap.']),
        JSON.stringify([item.title]), published
      );
      const signalId = Number(result.lastInsertRowid);
      item.themes.forEach((themeId, position) => linkTheme.run(signalId, themeId, 92 - position * 8));
    });

    db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?)')
      .run('system', 1, 'seed', 'RADARLINE fictional demonstration workspace initialized');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getSettings() {
  return Object.fromEntries(normalizeRows(db.prepare('SELECT key, value FROM settings').all()).map(row => [row.key, row.value]));
}

function getThemes() {
  return normalizeRows(db.prepare('SELECT * FROM themes ORDER BY id').all()).map(item => ({ ...item, active: Boolean(item.active) }));
}

function getSources() {
  return normalizeRows(db.prepare('SELECT * FROM sources ORDER BY authority DESC, name').all()).map(item => ({ ...item, active: Boolean(item.active) }));
}

function getSignals(options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 200));
  const rows = normalizeRows(db.prepare(`SELECT s.*, so.name AS source_name, so.kind AS source_kind,
    so.connector AS source_connector FROM signals s LEFT JOIN sources so ON so.id = s.source_id
    WHERE (? = 1 OR s.archived = 0) ORDER BY s.trace_score DESC, s.published_at DESC LIMIT ?`).all(options.includeArchived ? 1 : 0, limit));
  const relations = normalizeRows(db.prepare(`SELECT st.signal_id, st.match_score, t.id, t.name, t.color, t.horizon
    FROM signal_themes st JOIN themes t ON t.id = st.theme_id ORDER BY st.match_score DESC`).all());
  const bySignal = new Map();
  relations.forEach(row => {
    if (!bySignal.has(row.signal_id)) bySignal.set(row.signal_id, []);
    bySignal.get(row.signal_id).push({ id: row.id, name: row.name, color: row.color, horizon: row.horizon, match_score: row.match_score });
  });
  return rows.map(row => ({
    ...row,
    demo: Boolean(row.demo),
    archived: Boolean(row.archived),
    implications: JSON.parse(row.implications_json || '[]'),
    claims: JSON.parse(row.claims_json || '[]'),
    themes: bySignal.get(row.id) || []
  }));
}

function getSignal(id) {
  return getSignals({ includeArchived: true, limit: 500 }).find(item => item.id === Number(id)) || null;
}

function getBriefs() {
  return normalizeRows(db.prepare('SELECT * FROM briefs ORDER BY id DESC LIMIT 30').all()).map(item => ({
    ...item,
    signal_ids: JSON.parse(item.signal_ids_json || '[]')
  }));
}

function getSyncRuns() {
  return normalizeRows(db.prepare(`SELECT sr.*, s.name AS source_name FROM sync_runs sr
    LEFT JOIN sources s ON s.id = sr.source_id ORDER BY sr.id DESC LIMIT 30`).all());
}

function logAudit(entityType, entityId, action, detail = '') {
  db.prepare('INSERT INTO audit_log (entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?)')
    .run(entityType, entityId, action, String(detail).slice(0, 1_000));
}

function getAudit() {
  return normalizeRows(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50').all());
}

function getStats(signals, sources) {
  const live = signals.filter(item => !item.archived);
  const priority = live.filter(item => ['BRIEF', 'ACT'].includes(item.status));
  const recent = live.filter(item => Date.now() - new Date(item.published_at).getTime() <= 7 * 86_400_000);
  const sourceCoverage = sources.length ? Math.round(sources.filter(item => item.last_success_at || item.connector === 'manual').length / sources.length * 100) : 0;
  const averageTrace = live.length ? Math.round(live.reduce((sum, item) => sum + item.trace_score, 0) / live.length) : 0;
  const distributions = {
    status: Object.fromEntries(['BRIEF', 'INVESTIGATE', 'WATCH', 'IGNORE', 'ACT'].map(key => [key, live.filter(item => item.status === key).length])),
    horizon: Object.fromEntries(['now', 'next', 'later'].map(key => [key, live.filter(item => item.horizon === key).length])),
    types: Object.fromEntries([...new Set(live.map(item => item.signal_type))].map(key => [key, live.filter(item => item.signal_type === key).length]))
  };
  return {
    signals: live.length,
    recent: recent.length,
    priority: priority.length,
    verification_queue: live.filter(item => item.uncertainty >= 45 || item.hype_gap >= 25).length,
    active_sources: sources.filter(item => item.active).length,
    source_coverage: sourceCoverage,
    average_trace: averageTrace,
    local_first: true,
    distributions
  };
}

function getState() {
  const sources = getSources();
  const signals = getSignals();
  return {
    settings: getSettings(),
    themes: getThemes(),
    sources,
    signals,
    briefs: getBriefs(),
    sync_runs: getSyncRuns(),
    audit: getAudit(),
    stats: getStats(signals, sources),
    database: { engine: 'SQLite', mode: 'local-first', file: path.basename(databasePath), path: databasePath },
    protocol: { name: 'TRACE-1', version: '1.0', principle: 'AI may interpret a signal; it may not replace its evidence.' }
  };
}

function addSource(input) {
  const name = String(input.name || '').trim();
  const connector = String(input.connector || 'rss').toLowerCase();
  const supported = ['rss', 'json', 'github', 'hackernews', 'web', 'manual'];
  if (!name) throw new Error('Source name is required.');
  if (!supported.includes(connector)) throw new Error('Unsupported connector.');
  const url = String(input.url || '').trim();
  if (connector !== 'manual' && !url) throw new Error('A URL is required for this connector.');
  const result = db.prepare(`INSERT INTO sources
    (name, kind, connector, url, cadence, authority, language, active, creator_name, topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, input.kind || 'publication', connector, url, input.cadence || 'daily', Math.max(1, Math.min(100, Number(input.authority) || 60)), input.language || 'en', input.active === false ? 0 : 1, input.creator_name || '', input.topic || '');
  const id = Number(result.lastInsertRowid);
  logAudit('source', id, 'create', name);
  return normalize(db.prepare('SELECT * FROM sources WHERE id = ?').get(id));
}

function estimateNovelty(title) {
  const existing = normalizeRows(db.prepare('SELECT title FROM signals ORDER BY id DESC LIMIT 150').all());
  const maximum = existing.reduce((best, row) => Math.max(best, similarity(title, row.title)), 0);
  return Math.max(15, Math.round(100 - maximum * 100));
}

function estimateCorroboration(signalType, sourceId) {
  const row = normalize(db.prepare(`SELECT COUNT(DISTINCT source_id) AS count FROM signals
    WHERE signal_type = ? AND source_id IS NOT ? AND published_at >= datetime('now', '-14 days')`).get(signalType, sourceId));
  return Math.min(100, 26 + Number(row.count || 0) * 17);
}

function attachThemes(signalId, matches) {
  db.prepare('DELETE FROM signal_themes WHERE signal_id = ?').run(signalId);
  const insert = db.prepare('INSERT INTO signal_themes (signal_id, theme_id, match_score) VALUES (?, ?, ?)');
  matches.slice(0, 4).forEach(item => insert.run(signalId, item.theme.id, item.score));
}

function saveFetchedItems(sourceId, items) {
  const source = normalize(db.prepare('SELECT * FROM sources WHERE id = ?').get(Number(sourceId)));
  if (!source) throw new Error('Source not found.');
  const themes = getThemes().filter(item => item.active);
  const insert = db.prepare(`INSERT INTO signals (
    source_id, external_id, canonical_url, title, author, excerpt, content_hash, published_at,
    signal_type, status, horizon, relevance, novelty, authority, corroboration, freshness, traceability,
    uncertainty, trace_score, hype_gap, confidence, demo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
  const update = db.prepare(`UPDATE signals SET canonical_url = ?, title = ?, author = ?, excerpt = ?, content_hash = ?,
    published_at = ?, observed_at = CURRENT_TIMESTAMP, signal_type = ?, horizon = ?, relevance = ?, novelty = ?,
    authority = ?, corroboration = ?, freshness = ?, traceability = ?, uncertainty = ?, trace_score = ?, hype_gap = ?,
    confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  let newCount = 0;
  db.exec('BEGIN');
  try {
    for (const item of items) {
      const existing = normalize(db.prepare('SELECT id, content_hash, status FROM signals WHERE source_id = ? AND external_id = ?').get(source.id, item.external_id));
      const provisionalType = require('./scoring').classifySignal(`${item.title} ${item.excerpt}`);
      const scored = scoreSignal({
        ...item,
        authority: source.authority,
        novelty: estimateNovelty(item.title),
        corroboration: estimateCorroboration(provisionalType, source.id)
      }, { themes, sourceAuthority: source.authority });
      let id;
      if (existing) {
        id = existing.id;
        update.run(item.canonical_url, item.title, item.author, item.excerpt, item.content_hash, item.published_at,
          scored.signal_type, scored.horizon, scored.relevance, scored.novelty, scored.authority, scored.corroboration,
          scored.freshness, scored.traceability, scored.uncertainty, scored.trace_score, scored.hype_gap,
          scored.confidence, id);
      } else {
        const result = insert.run(source.id, item.external_id, item.canonical_url, item.title, item.author, item.excerpt,
          item.content_hash, item.published_at, scored.signal_type, scored.status, scored.horizon, scored.relevance,
          scored.novelty, scored.authority, scored.corroboration, scored.freshness, scored.traceability,
          scored.uncertainty, scored.trace_score, scored.hype_gap, scored.confidence);
        id = Number(result.lastInsertRowid);
        newCount += 1;
      }
      attachThemes(id, scored.matches);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  db.prepare(`UPDATE sources SET items_seen = items_seen + ?, last_checked_at = CURRENT_TIMESTAMP,
    last_success_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(items.length, source.id);
  logAudit('source', source.id, 'sync', `${newCount} new / ${items.length} fetched`);
  return { fetched_count: items.length, new_count: newCount };
}

function addManualSignal(input) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Signal title is required.');
  const sourceId = Number(input.source_id) || null;
  const source = sourceId ? normalize(db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId)) : null;
  const item = {
    title,
    excerpt: String(input.excerpt || '').trim(),
    canonical_url: String(input.canonical_url || '').trim(),
    author: String(input.author || '').trim(),
    published_at: input.published_at ? new Date(input.published_at).toISOString() : new Date().toISOString()
  };
  item.content_hash = hash(`${item.title}|${item.excerpt}|${item.canonical_url}`);
  item.external_id = `manual-${item.content_hash.slice(0, 18)}`;
  const themes = getThemes().filter(theme => theme.active);
  const scored = scoreSignal({ ...item, authority: source?.authority || Number(input.authority) || 55, novelty: estimateNovelty(title) }, { themes });
  const result = db.prepare(`INSERT INTO signals (
    source_id, external_id, canonical_url, title, author, excerpt, content_hash, published_at, signal_type,
    status, horizon, relevance, novelty, authority, corroboration, freshness, traceability, uncertainty,
    trace_score, hype_gap, confidence, demo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(sourceId, item.external_id, item.canonical_url, item.title, item.author, item.excerpt, item.content_hash,
      item.published_at, scored.signal_type, scored.status, scored.horizon, scored.relevance, scored.novelty,
      scored.authority, scored.corroboration, scored.freshness, scored.traceability, scored.uncertainty,
      scored.trace_score, scored.hype_gap, scored.confidence);
  const id = Number(result.lastInsertRowid);
  attachThemes(id, scored.matches);
  logAudit('signal', id, 'capture', title);
  return getSignal(id);
}

function updateSignal(id, input) {
  const current = getSignal(id);
  if (!current) return null;
  const status = ['IGNORE', 'WATCH', 'INVESTIGATE', 'BRIEF', 'ACT'].includes(input.status) ? input.status : current.status;
  const horizon = ['now', 'next', 'later'].includes(input.horizon) ? input.horizon : current.horizon;
  const archived = input.archived === undefined ? Number(current.archived) : input.archived ? 1 : 0;
  db.prepare('UPDATE signals SET status = ?, horizon = ?, archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, horizon, archived, Number(id));
  logAudit('signal', Number(id), 'triage', `${status} · ${horizon}${archived ? ' · archived' : ''}`);
  return getSignal(id);
}

function saveAnalysis(id, analysis) {
  const current = getSignal(id);
  if (!current) return null;
  db.prepare(`UPDATE signals SET ai_summary = ?, why_it_matters = ?, signal_type = ?, horizon = ?,
    implications_json = ?, claims_json = ?, model = ?, analyzed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`).run(
    analysis.summary || '', analysis.why_it_matters || '', analysis.signal_type || current.signal_type,
    analysis.horizon || current.horizon, JSON.stringify(analysis.implications || []),
    JSON.stringify(analysis.claims || []), analysis.model || 'deterministic-fallback', Number(id)
  );
  logAudit('signal', Number(id), 'analyze', analysis.model || 'deterministic-fallback');
  return getSignal(id);
}

function startSync(sourceId) {
  const result = db.prepare('INSERT INTO sync_runs (source_id, status) VALUES (?, ?)').run(Number(sourceId), 'running');
  return Number(result.lastInsertRowid);
}

function finishSync(runId, result = {}, error = '') {
  const status = error ? 'failed' : 'completed';
  db.prepare(`UPDATE sync_runs SET status = ?, fetched_count = ?, new_count = ?, error = ?,
    finished_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status, Number(result.fetched_count) || 0, Number(result.new_count) || 0, String(error || '').slice(0, 600), Number(runId));
  const row = normalize(db.prepare('SELECT source_id FROM sync_runs WHERE id = ?').get(Number(runId)));
  if (error && row?.source_id) {
    db.prepare(`UPDATE sources SET last_checked_at = CURRENT_TIMESTAMP, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(String(error).slice(0, 600), row.source_id);
  }
}

function createBrief(period = 'daily') {
  const payload = buildBrief(getSignals(), period);
  const result = db.prepare(`INSERT INTO briefs (period, title, executive_summary, body_md, signal_ids_json, model)
    VALUES (?, ?, ?, ?, ?, ?)`).run(period, payload.title, payload.executive_summary, payload.body_md, JSON.stringify(payload.signal_ids), payload.model);
  const id = Number(result.lastInsertRowid);
  logAudit('brief', id, 'generate', payload.title);
  return getBriefs().find(item => item.id === id);
}

function getBrief(id) {
  return getBriefs().find(item => item.id === Number(id)) || null;
}

function exportTrace() {
  const state = getState();
  return {
    trace1_version: '1.0',
    exported_at: new Date().toISOString(),
    workspace: state.settings,
    protocol: state.protocol,
    sources: state.sources,
    themes: state.themes,
    signals: state.signals.map(item => ({
      id: item.id,
      title: item.title,
      source: item.source_name,
      source_id: item.source_id,
      canonical_url: item.canonical_url,
      content_hash: item.content_hash,
      published_at: item.published_at,
      observed_at: item.observed_at,
      classification: { type: item.signal_type, status: item.status, horizon: item.horizon },
      scores: {
        relevance: item.relevance, novelty: item.novelty, authority: item.authority,
        corroboration: item.corroboration, freshness: item.freshness, traceability: item.traceability,
        uncertainty: item.uncertainty, trace: item.trace_score, hype_gap: item.hype_gap,
        confidence: item.confidence
      },
      themes: item.themes,
      analysis: {
        summary: item.ai_summary,
        why_it_matters: item.why_it_matters,
        implications: item.implications,
        claims: item.claims,
        model: item.model,
        analyzed_at: item.analyzed_at
      },
      demo: item.demo
    }))
  };
}

seedDatabase();

module.exports = {
  db,
  databasePath,
  demoDatabasePath,
  getState,
  getSettings,
  getThemes,
  getSources,
  getSignals,
  getSignal,
  getBriefs,
  getBrief,
  addSource,
  addManualSignal,
  saveFetchedItems,
  updateSignal,
  saveAnalysis,
  startSync,
  finishSync,
  createBrief,
  exportTrace,
  logAudit,
  close: () => db.close()
};
