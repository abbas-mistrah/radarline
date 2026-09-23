'use strict';

const app = {
  data: null,
  view: 'command',
  theme: 'all',
  status: 'all',
  query: '',
  briefId: null,
  busy: new Set()
};

const views = {
  command: 'Command Center',
  inbox: 'Signal Inbox',
  radar: 'Radar Map',
  watchlists: 'Watch Themes',
  sources: 'Source Network',
  'local-ai': 'Local AI',
  brief: 'Briefing Room',
  protocol: 'TRACE-1 Protocol'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeColor(value, fallback = '#ff681e') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function safeUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function number(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0);
}

function compactDate(value) {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
}

function longDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function relativeDate(value) {
  if (!value) return 'date unknown';
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return 'date unknown';
  const hours = Math.max(0, Math.round(delta / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function bytes(value) {
  const size = Number(value) || 0;
  if (!size) return 'size unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  return `${(size / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function typeLabel(value) {
  return String(value || 'OTHER').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function scoreColor(status) {
  return status === 'BRIEF' || status === 'ACT' ? '#198754' : status === 'INVESTIGATE' ? '#c77a04' : status === 'WATCH' ? '#2d66d2' : '#796f66';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`);
  return payload;
}

function toast(message, tone = 'success') {
  const container = $('#toastStack');
  const item = document.createElement('div');
  item.className = 'toast';
  if (tone === 'error') {
    item.style.background = 'var(--red-soft)';
    item.style.borderColor = '#f1c2bc';
  }
  item.innerHTML = `<i style="background:${tone === 'error' ? 'var(--red)' : 'var(--green)'}">${tone === 'error' ? '!' : '✓'}</i><span>${escapeHtml(message)}</span><button aria-label="Dismiss">×</button>`;
  $('button', item).addEventListener('click', () => item.remove());
  container.append(item);
  setTimeout(() => item.remove(), 5200);
}

function setBusy(name, active) {
  if (active) app.busy.add(name); else app.busy.delete(name);
  $$(`[data-action="${name}"]`).forEach(button => {
    button.disabled = active;
    button.setAttribute('aria-busy', String(active));
  });
}

function filteredSignals() {
  if (!app.data) return [];
  const needle = app.query.trim().toLowerCase();
  return app.data.signals.filter(signal => {
    const themeMatch = app.theme === 'all' || signal.themes.some(theme => String(theme.id) === String(app.theme));
    const statusMatch = app.status === 'all' || signal.status === app.status;
    const haystack = `${signal.title} ${signal.excerpt} ${signal.ai_summary} ${signal.source_name} ${signal.signal_type}`.toLowerCase();
    return themeMatch && statusMatch && (!needle || haystack.includes(needle));
  });
}

function themeTags(signal, limit = 3) {
  return signal.themes.slice(0, limit).map(theme => `<span class="tag" style="border-color:${safeColor(theme.color)}40;color:${safeColor(theme.color)}">${escapeHtml(theme.name)}</span>`).join('');
}

function signalSummary(signal) {
  return signal.ai_summary || signal.excerpt || 'Open the source and classify this signal.';
}

function pageHero(eyebrow, title, copy, actions = '') {
  return `<div class="page-hero"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div>${actions ? `<div class="hero-actions">${actions}</div>` : ''}</div>`;
}

function renderCommand() {
  const { stats, ai } = app.data;
  const signals = filteredSignals();
  const top = signals.filter(item => item.status !== 'IGNORE').slice(0, 3);
  const now = signals.filter(item => item.horizon === 'now').slice(0, 3);
  const next = signals.filter(item => item.horizon === 'next').slice(0, 3);
  const later = signals.filter(item => item.horizon === 'later').slice(0, 3);
  const priorityPercent = stats.signals ? Math.round(stats.priority / stats.signals * 100) : 0;
  const verified = app.data.sources.filter(source => source.last_success_at || source.connector === 'manual').length;

  const leadCards = top.map(signal => `<article class="lead-signal" data-signal="${signal.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(signal.title)}">
    <header><span class="badge ${escapeHtml(signal.status)}">${escapeHtml(signal.status)}</span><span class="trace-mini">TRACE ${signal.trace_score}<i style="--value:${signal.trace_score}%"></i></span></header>
    <h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signalSummary(signal))}</p>
  </article>`).join('') || '<div class="empty-state"><div><i>⌁</i><h2>No signal in focus</h2><p>Choose another watch theme or synchronize your sources.</p></div></div>';

  const days = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date.getTime() + 86_400_000);
    const rows = signals.filter(item => {
      const published = new Date(item.published_at);
      return published >= date && published < nextDate;
    });
    const priority = rows.filter(item => ['BRIEF', 'ACT'].includes(item.status)).length;
    return {
      label: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date),
      all: Math.max(4, Math.min(100, rows.length * 17)),
      priority: Math.max(3, Math.min(100, priority * 27))
    };
  });

  const horizonCard = (label, list, description, className) => `<section class="horizon-card ${className}"><header><strong>${label}</strong><span>${list.length}</span></header><p>${description}</p><ul>${list.map(item => `<li data-signal="${item.id}">${escapeHtml(item.title)}</li>`).join('') || '<li>No signal in this horizon.</li>'}</ul></section>`;

  return `<div class="page">
    ${pageHero('Executive sensing layer', 'See what changed. Know what matters.', 'A source-grounded operating picture for technology and AI decisions — collected, scored and interpreted on your machine.', `<button class="button dark" data-view="inbox">Open signal inbox</button><button class="button primary" data-action="generate-brief" data-period="daily">Build today’s brief</button>`)}
    <section class="intel-layout">
      <article class="morning-card">
        <div class="morning-top"><div><span class="mini-label">MORNING INTELLIGENCE</span><h2>Your decision-ready picture</h2></div><span class="badge green">TRACE-1 ACTIVE</span></div>
        <div class="morning-body"><div class="attention-orbit" style="--score:${stats.average_trace}"><div class="orbit-core"><span>AVERAGE TRACE</span><strong>${stats.average_trace}</strong><small>evidence quality / 100</small></div></div><div class="lead-list">${leadCards}</div></div>
      </article>
      <aside class="side-stack">
        <article class="summary-card" style="--accent:${ai.available ? 'var(--green)' : 'var(--amber)'}"><header><span>LOCAL INTELLIGENCE</span><i></i></header><strong>${ai.available ? 'Ready' : 'Fallback'}</strong><p>${ai.available ? `${escapeHtml(ai.selected_model)} is available for private structured analysis.` : 'Deterministic analysis remains available; Ollama is optional.'}</p><div class="microbar"><i style="--value:${ai.available ? 100 : 45}%"></i></div></article>
        <article class="summary-card" style="--accent:var(--purple)"><header><span>SOURCE COVERAGE</span><i></i></header><strong>${stats.source_coverage}%</strong><p>${verified} of ${app.data.sources.length} sources have a successful check or a curated manual workflow.</p><div class="microbar"><i style="--value:${stats.source_coverage}%"></i></div></article>
        <article class="summary-card" style="--accent:var(--orange)"><header><span>DECISION PRESSURE</span><i></i></header><strong>${stats.priority}</strong><p>${priorityPercent}% of active signals are ready for a brief or action review.</p><div class="microbar"><i style="--value:${priorityPercent}%"></i></div></article>
      </aside>
    </section>
    <section class="kpi-grid">
      <article class="kpi-card"><span>ACTIVE SIGNALS</span><strong>${number(stats.signals)}</strong><small>Across all watch themes</small><em>${stats.recent} observed in 7 days</em></article>
      <article class="kpi-card"><span>BRIEF-READY</span><strong>${number(stats.priority)}</strong><small>High-value decision queue</small><em>Evidence retained</em></article>
      <article class="kpi-card"><span>VERIFY NEXT</span><strong>${number(stats.verification_queue)}</strong><small>Material uncertainty or hype</small><em style="color:var(--amber)">Human review required</em></article>
      <article class="kpi-card"><span>ACTIVE SOURCES</span><strong>${number(stats.active_sources)}</strong><small>Feeds, repositories and curation</small><em>Local source registry</em></article>
      <article class="kpi-card"><span>DATA CONTROL</span><strong>100%</strong><small>Runtime data stays in SQLite</small><em>No cloud database</em></article>
    </section>
    <div class="spacer"></div>
    <section class="grid cols-2">
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">SIGNAL VELOCITY</span><h2>Seven-day movement</h2><p>All observed signals versus brief-ready signals.</p></div><span class="badge purple">7 DAYS</span></div><div class="velocity">${days.map(day => `<div class="velocity-col"><div class="velocity-bars"><i style="--height:${day.all}%"></i><i style="--height:${day.priority}%"></i></div><span>${day.label}</span></div>`).join('')}</div></article>
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">TIME HORIZONS</span><h2>Now / Next / Later</h2><p>Turn novelty into an explicit response horizon.</p></div></div><div class="horizon-grid">${horizonCard('NOW', now, 'Operating impact in the current cycle.', 'now')}${horizonCard('NEXT', next, 'Investigate, prepare and preserve options.', 'next')}${horizonCard('LATER', later, 'Watch weak signals without premature action.', 'later')}</div></article>
    </section>
  </div>`;
}

function renderSignalRow(signal) {
  return `<article class="signal-row" data-signal="${signal.id}" tabindex="0" role="button">
    <div class="signal-score" style="--score:${signal.trace_score};--score-color:${scoreColor(signal.status)}"><strong>${signal.trace_score}</strong></div>
    <div class="signal-main"><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signalSummary(signal))}</p><footer>${themeTags(signal)}${signal.demo ? '<span class="tag">FICTIONAL DEMO</span>' : '<span class="tag">LIVE / CAPTURED</span>'}</footer></div>
    <div class="signal-source"><strong>${escapeHtml(signal.source_name || 'Manual capture')}</strong><span>${escapeHtml(signal.source_kind || 'local record')}</span></div>
    <div class="signal-meta"><strong>${escapeHtml(typeLabel(signal.signal_type))}</strong><span>${relativeDate(signal.published_at)} · ${escapeHtml(signal.horizon.toUpperCase())}</span></div>
    <div class="signal-actions"><span class="badge ${escapeHtml(signal.status)}">${escapeHtml(signal.status)}</span></div>
  </article>`;
}

function renderInbox() {
  const signals = filteredSignals();
  const statuses = ['all', 'BRIEF', 'INVESTIGATE', 'WATCH', 'ACT', 'IGNORE'];
  return `<div class="page">
    ${pageHero('Evidence before interpretation', 'Signal Inbox', 'Triage every signal without losing the source, time, content fingerprint or uncertainty behind it.', `<button class="button ghost" data-action="capture-signal">+ Capture signal</button><button class="button primary" data-action="analyze-batch">Analyze priority</button>`)}
    <div class="toolbar"><label class="search-box"><span>⌕</span><input id="signalSearch" type="search" placeholder="Search titles, sources, types or analysis…" value="${escapeHtml(app.query)}"></label><div class="filter-pills">${statuses.map(status => `<button class="filter-pill ${app.status === status ? 'active' : ''}" data-status="${status}">${status === 'all' ? 'ALL' : status}</button>`).join('')}</div></div>
    <div class="signal-list">${signals.map(renderSignalRow).join('') || '<div class="empty-state"><div><i>⌁</i><h2>No matching signal</h2><p>Clear a filter, change the watch theme or capture a new source-backed signal.</p></div></div>'}</div>
  </div>`;
}

function radarPosition(signal) {
  const angle = ((signal.id * 137.508) + (signal.trace_score * 1.7)) * Math.PI / 180;
  const distance = signal.horizon === 'now' ? 15 + (signal.id % 5) : signal.horizon === 'next' ? 28 + (signal.id % 7) : 40 + (signal.id % 5);
  return {
    x: (50 + Math.cos(angle) * distance).toFixed(2),
    y: (50 + Math.sin(angle) * distance).toFixed(2),
    size: Math.round(9 + signal.trace_score / 12)
  };
}

function renderRadar() {
  const signals = filteredSignals().filter(item => item.status !== 'IGNORE').slice(0, 45);
  const clusters = app.data.themes.map(theme => ({
    ...theme,
    signals: signals.filter(signal => signal.themes.some(item => item.id === theme.id))
  })).sort((a, b) => b.signals.length - a.signals.length);
  const points = signals.map(signal => {
    const pos = radarPosition(signal);
    const theme = signal.themes[0];
    return `<button class="radar-point" data-signal="${signal.id}" data-label="${escapeHtml(signal.title)}" aria-label="${escapeHtml(signal.title)}" style="--x:${pos.x}%;--y:${pos.y}%;--size:${pos.size}px;--point:${safeColor(theme?.color, scoreColor(signal.status))}"></button>`;
  }).join('');
  return `<div class="page">
    ${pageHero('Pattern detection', 'Strategic Radar Map', 'Read proximity, theme concentration and time horizon at a glance. Open any point to inspect the underlying evidence.', `<button class="button ghost" data-view="watchlists">Edit focus</button><button class="button primary" data-action="sync">Refresh radar</button>`)}
    <section class="radar-shell">
      <article class="panel radar-panel"><div class="panel-head"><div><span class="mini-label">ACTIVE FIELD · ${signals.length} SIGNALS</span><h2>Technology change map</h2><p>Closer to the centre means nearer-term operating impact.</p></div><span class="badge purple">LIVE MODEL</span></div><div class="radar-plot"><i class="radar-ring" style="--inset:18%"></i><i class="radar-ring" style="--inset:34%"></i><i class="radar-axis-x"></i><i class="radar-axis-y"></i><i class="radar-sweep"></i><span class="radar-label now">NOW</span><span class="radar-label next">NEXT</span><span class="radar-label later">LATER</span><span class="radar-label core">IMPACT</span>${points}</div></article>
      <aside class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">THEME CLUSTERS</span><h2>Where change gathers</h2><p>Signal counts respect the active focus filter.</p></div></div><div class="cluster-list">${clusters.map(theme => `<article class="cluster-card"><header><i style="--cluster:${safeColor(theme.color)}"></i><strong>${escapeHtml(theme.name)}</strong><span>${theme.signals.length}</span></header><p>${escapeHtml(theme.question)}</p></article>`).join('')}</div><div class="spacer"></div><div class="formula">POSITION = horizon × theme × TRACE score<br>POINT SIZE = evidence quality<br>COLOUR = primary watch theme</div></aside>
    </section>
  </div>`;
}

function renderWatchlists() {
  const themes = app.data.themes.map(theme => ({ ...theme, count: app.data.signals.filter(signal => signal.themes.some(item => item.id === theme.id)).length }));
  const creators = app.data.sources.filter(source => source.kind === 'creator' || source.creator_name);
  return `<div class="page">
    ${pageHero('Deliberate attention', 'Watch Themes', 'Define the strategic questions that deserve attention. Keywords help detection; exclusions protect the radar from predictable noise.', `<button class="button primary" data-action="capture-signal">Capture intelligence</button>`)}
    <section class="theme-grid">${themes.map(theme => `<article class="theme-card" style="--theme:${safeColor(theme.color)}"><header><i></i><strong>${theme.count}</strong></header><h2>${escapeHtml(theme.name)}</h2><p>${escapeHtml(theme.question)}</p><footer>${String(theme.include_keywords || '').split(',').slice(0, 6).map(word => `<span class="tag">${escapeHtml(word.trim())}</span>`).join('')}</footer></article>`).join('')}</section>
    <div class="spacer"></div>
    <section class="grid cols-2">
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">CREATOR &amp; PRACTITIONER WATCH</span><h2>Human edge network</h2><p>Manual curation remains explicit when a permitted feed is not available.</p></div><span class="badge amber">HUMAN CURATED</span></div>${creators.map(source => `<div class="model-row"><i style="background:var(--orange)"></i><div><strong>${escapeHtml(source.creator_name || source.name)}</strong><span>${escapeHtml(source.topic || source.kind)}</span></div><span>${escapeHtml(source.cadence)}</span></div>`).join('') || '<p class="detail-copy">Add creator sources from the Source Network.</p>'}</article>
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">EDITORIAL CONTRACT</span><h2>What enters the radar</h2><p>A signal must be decision-relevant, traceable and time-bounded.</p></div></div><div class="flow-steps" style="grid-template-columns:repeat(3,1fr)"><article class="flow-step"><i>01</i><strong>Question</strong><p>Start with a strategic question, not a generic topic.</p></article><article class="flow-step"><i style="--accent:var(--purple)">02</i><strong>Evidence</strong><p>Preserve origin, timestamp, hash and explicit uncertainty.</p></article><article class="flow-step"><i style="--accent:var(--green)">03</i><strong>Decision</strong><p>Route to ignore, watch, investigate, brief or act.</p></article></div></article>
    </section>
  </div>`;
}

function renderSources() {
  const { sources, stats } = app.data;
  const connectorCounts = Object.fromEntries(['rss', 'github', 'hackernews', 'web', 'json', 'manual'].map(name => [name, sources.filter(source => source.connector === name).length]));
  const connectorCards = [
    ['RSS / ATOM', 'rss', 'R', 'Structured publication and research feeds.', '#ff681e'],
    ['GITHUB', 'github', 'G', 'Repository releases from the public GitHub API.', '#6650e5'],
    ['COMMUNITY', 'hackernews', 'H', 'Public builder discourse through HN Algolia.', '#198754'],
    ['WEB / JSON', 'web', 'W', 'Bounded pages and machine-readable feeds.', '#2d66d2'],
    ['MANUAL', 'manual', '+', 'Creators, social links and human field notes.', '#c77a04']
  ];
  return `<div class="page">
    ${pageHero('Source architecture', 'Source Network', 'Use public, permitted connectors and preserve each source’s authority, cadence and health. Social sources remain manual unless a compliant feed or API is configured.', `<button class="button ghost" data-action="add-source">+ Add source</button><button class="button primary" data-action="sync">Sync active sources</button>`)}
    <section class="source-overview">
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">SOURCE REGISTRY</span><h2>${sources.length} governed inputs</h2><p>Authority is explicit and can never be inferred from popularity alone.</p></div><span class="badge green">${stats.active_sources} ACTIVE</span></div><div style="overflow-x:auto"><table class="source-table"><thead><tr><th>SOURCE</th><th>CONNECTOR</th><th>AUTHORITY</th><th>LAST SUCCESS</th><th>HEALTH</th></tr></thead><tbody>${sources.map(source => {
        const healthy = source.connector === 'manual' || Boolean(source.last_success_at);
        const health = source.last_error ? ['#c94035', 'Error'] : healthy ? ['#198754', source.connector === 'manual' ? 'Curated' : 'Ready'] : ['#c77a04', 'Not checked'];
        return `<tr><td class="source-name"><strong>${escapeHtml(source.name)}</strong><span>${escapeHtml(source.topic || source.kind)}</span></td><td><span class="tag">${escapeHtml(source.connector)}</span></td><td><strong>${source.authority}</strong> / 100</td><td>${compactDate(source.last_success_at)}</td><td><span class="health-dot" style="--health:${health[0]}"></span>${health[1]}</td></tr>`;
      }).join('')}</tbody></table></div></article>
      <aside class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">OBSERVABILITY</span><h2>Coverage health</h2><p>Manual sources count as governed workflows, not automated checks.</p></div></div><div class="coverage-ring" style="--coverage:${stats.source_coverage}"><div><strong>${stats.source_coverage}%</strong><span>COVERED</span></div></div><div class="grid cols-2"><div class="score-cell"><span>SYNC RUNS</span><strong>${app.data.sync_runs.length}</strong></div><div class="score-cell"><span>ITEMS SEEN</span><strong>${number(sources.reduce((sum, source) => sum + Number(source.items_seen || 0), 0))}</strong></div></div></aside>
    </section>
    <div class="spacer"></div>
    <section class="connector-grid">${connectorCards.map(([label, key, icon, copy, color]) => `<article class="connector-card"><i style="--accent:${color}">${icon}</i><strong>${label} · ${connectorCounts[key] || (key === 'web' ? (connectorCounts.web + connectorCounts.json) : 0)}</strong><p>${copy}</p></article>`).join('')}</section>
  </div>`;
}

function renderLocalAi() {
  const { ai } = app.data;
  const ready = ai.available;
  return `<div class="page">
    <section class="ai-hero"><div><div class="eyebrow">PRIVATE ANALYSIS LAYER</div><h1>Local intelligence, bounded by evidence.</h1><p>RADARLINE asks a local model for structured synthesis, implications and claims. Source material is treated as untrusted data; the model cannot overwrite provenance or the TRACE score.</p><div class="model-chip"><i style="background:${ready ? '#5ee29c' : '#f2bd5a'}"></i>${escapeHtml(ready ? ai.selected_model : 'deterministic-fallback')}</div><div class="hero-actions" style="margin-top:17px"><button class="button primary" data-action="analyze-batch" ${ready ? '' : ''}>Analyze priority queue</button><button class="button ghost" data-view="protocol" style="color:white;border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.06)">Inspect guardrails</button></div></div><div class="ai-status-card"><span>LOCAL RUNTIME</span><strong>${ready ? 'OLLAMA READY' : 'SAFE FALLBACK'}</strong><p>${ready ? `${ai.models.length} local model${ai.models.length === 1 ? '' : 's'} detected. No prompt or document leaves this machine.` : 'Ollama is optional. Deterministic summaries keep the workspace functional without a model.'}</p></div></section>
    <div class="spacer"></div>
    <section class="flow-steps"><article class="flow-step"><i>01</i><strong>Bound evidence</strong><p>Title, excerpt, source authority and timestamp enter a limited prompt.</p></article><article class="flow-step"><i style="--accent:var(--purple)">02</i><strong>Isolate instructions</strong><p>Source text is untrusted content, never a system instruction.</p></article><article class="flow-step"><i style="--accent:var(--blue)">03</i><strong>Constrain output</strong><p>A JSON schema limits fields, classifications and horizon values.</p></article><article class="flow-step"><i style="--accent:var(--green)">04</i><strong>Retain lineage</strong><p>Analysis is stored beside — never instead of — the original evidence.</p></article></section>
    <div class="spacer"></div>
    <section class="grid cols-2">
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">MODEL REGISTRY</span><h2>Detected local models</h2><p>RADARLINE prefers a capable small model and falls back safely.</p></div><span class="badge ${ready ? 'green' : 'amber'}">${ready ? 'PRIVATE' : 'OPTIONAL'}</span></div><div class="model-list">${ai.models.length ? ai.models.map(model => `<div class="model-row"><i style="background:${model.name === ai.selected_model ? 'var(--green)' : 'var(--soft)'}"></i><strong>${escapeHtml(model.name)}</strong><span>${bytes(model.size)}</span></div>`).join('') : '<div class="empty-state" style="min-height:180px"><div><i>✦</i><h2>No runtime required</h2><p>Install Ollama only if you want language-model synthesis. All other features remain operational.</p></div></div>'}</div></article>
      <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">PRIVACY BOUNDARY</span><h2>What stays local</h2><p>A deliberate architecture for sensitive intelligence work.</p></div></div><div class="cluster-list"><article class="cluster-card"><header><i style="--cluster:var(--green)"></i><strong>SQLite workspace</strong><span>LOCAL</span></header><p>Signals, notes, briefs, source health and audit history remain in one portable database.</p></article><article class="cluster-card"><header><i style="--cluster:var(--purple)"></i><strong>Model inference</strong><span>LOCAL</span></header><p>When Ollama is available, synthesis runs through 127.0.0.1 with structured output.</p></article><article class="cluster-card"><header><i style="--cluster:var(--orange)"></i><strong>Network boundary</strong><span>EXPLICIT</span></header><p>Only user-defined source synchronisation reaches public URLs. No telemetry endpoint is included.</p></article></div></article>
    </section>
  </div>`;
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdown(value) {
  const lines = String(value || '').split(/\r?\n/);
  const output = [];
  let list = null;
  const closeList = () => { if (list) { output.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line === '---') { closeList(); output.push('<hr>'); continue; }
    if (line.startsWith('### ')) { closeList(); output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## ')) { closeList(); output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# ')) { closeList(); output.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('> ')) { closeList(); output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); continue; }
    const ordered = line.match(/^\d+\.\s+(.+)/);
    if (ordered) { if (list !== 'ol') { closeList(); list = 'ol'; output.push('<ol>'); } output.push(`<li>${inlineMarkdown(ordered[1])}</li>`); continue; }
    if (line.startsWith('- ')) { if (list !== 'ul') { closeList(); list = 'ul'; output.push('<ul>'); } output.push(`<li>${inlineMarkdown(line.slice(2))}</li>`); continue; }
    closeList();
    output.push(`<p>${inlineMarkdown(line.replace(/\s{2}$/, ''))}</p>`);
  }
  closeList();
  return output.join('');
}

function renderBrief() {
  const latest = app.data.briefs.find(item => item.id === app.briefId) || app.data.briefs[0];
  const preview = latest ? markdown(latest.body_md) : `<div class="document-mark"><span>RADARLINE</span><span>TRACE-1</span></div><h1>Your briefing room is ready.</h1><p class="brief-meta">No generated brief yet</p><blockquote>Transform a ranked evidence set into a concise executive read — without confusing synthesis with proof.</blockquote><h2>One click, explicit discipline</h2><p>Generate a daily or weekly brief from your current signal queue. Every section retains a direct path back to the source-backed record.</p>`;
  return `<div class="page">
    ${pageHero('Decision communication', 'Briefing Room', 'Convert the evidence queue into a clear executive narrative, generated locally and exportable as Markdown.', `<button class="button ghost" data-action="generate-brief" data-period="weekly">New weekly brief</button><button class="button primary" data-action="generate-brief" data-period="daily">Generate daily brief</button>`)}
    <section class="brief-layout"><article class="brief-paper">${latest ? `<div class="document-mark"><span>RADARLINE · INTELLIGENCE BRIEF</span><span>TRACE-1</span></div>${preview}` : preview}</article><aside class="side-stack"><article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">BRIEF LIBRARY</span><h3>Recent editions</h3></div></div><div class="brief-index">${app.data.briefs.map(brief => `<button data-brief="${brief.id}" ${brief.id === latest?.id ? 'style="border-color:#ffb78e;background:var(--orange-soft)"' : ''}><strong>${escapeHtml(brief.title)}</strong><span>${compactDate(brief.created_at)} · ${brief.signal_ids.length} signals</span></button>`).join('') || '<p class="detail-copy">Generated briefs will appear here.</p>'}</div></article><article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">PORTABILITY</span><h3>Own the output</h3></div></div><p class="detail-copy">Download a Markdown brief, the TRACE-1 evidence export or the complete local SQLite database.</p><div class="hero-actions" style="margin-top:13px;flex-wrap:wrap"><a class="button small" href="${latest ? `/api/briefs/${latest.id}/download` : '#'}" ${latest ? 'download' : 'aria-disabled="true"'}>Download brief</a><button class="button small" data-action="export-trace">TRACE-1 JSON</button><button class="button small" data-action="download-db">SQLite</button></div></article></aside></section>
  </div>`;
}

function renderProtocol() {
  const fields = [
    ['source + canonical_url', 'Where the signal came from', 'Required for live evidence'],
    ['content_hash', 'Fingerprint of the captured material', 'Detects silent change'],
    ['published_at + observed_at', 'When it happened and when it was seen', 'Preserves chronology'],
    ['relevance', 'Fit with explicit watch questions', '0–100'],
    ['authority', 'Source quality set by the user', '0–100'],
    ['corroboration', 'Independent source support', '0–100'],
    ['uncertainty + hype_gap', 'What remains unproven', 'Visible, never hidden'],
    ['analysis.model', 'How interpretation was produced', 'Local model or fallback']
  ];
  return `<div class="page">
    <section class="protocol-hero"><div><div class="eyebrow">OPEN EVIDENCE CONTRACT</div><h1>TRACE-1 Protocol</h1><p>A portable record for decision-grade technology intelligence. TRACE-1 separates source evidence, scoring, machine interpretation and human routing so that confidence can be inspected — not merely asserted.</p><div class="hero-actions"><a class="button dark" href="/api/protocol" download="trace-1.schema.json">Download JSON Schema</a><button class="button primary" data-action="export-trace">Export workspace</button></div></div><div class="trace-lockup"><div class="trace-letter" style="--letter:#ff681e"><strong>T</strong><span>TRACEABILITY</span><small>Origin &amp; lineage</small></div><div class="trace-letter" style="--letter:#6650e5"><strong>R</strong><span>RELEVANCE</span><small>Decision fit</small></div><div class="trace-letter" style="--letter:#198754"><strong>A</strong><span>AUTHORITY</span><small>Source quality</small></div><div class="trace-letter" style="--letter:#2d66d2"><strong>C</strong><span>CORROBORATION</span><small>Independent support</small></div><div class="trace-letter" style="--letter:#c77a04"><strong>E</strong><span>EXPIRY</span><small>Freshness &amp; horizon</small></div></div></section>
    <div class="spacer"></div>
    <section class="grid cols-2"><article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">SCORING MODEL</span><h2>Evidence quality, not virality</h2><p>Weights are deterministic, transparent and testable.</p></div></div><div class="formula">TRACE = 0.25 × relevance<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.18 × novelty<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.18 × authority<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.14 × corroboration<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.12 × freshness<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.13 × traceability<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;− 0.12 × uncertainty<br><br>confidence = evidence quality + certainty<br>hype gap = attention proxies − evidence strength</div></article><article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">NON-NEGOTIABLE RULE</span><h2>Interpretation never replaces evidence.</h2><p>The original record survives every downstream summary.</p></div></div><div class="cluster-list"><article class="cluster-card"><header><i style="--cluster:var(--orange)"></i><strong>Machine role</strong><span>INTERPRET</span></header><p>Summarise, classify and surface implications inside a strict schema.</p></article><article class="cluster-card"><header><i style="--cluster:var(--purple)"></i><strong>Human role</strong><span>DECIDE</span></header><p>Set authority, verify claims, route status and own the decision.</p></article><article class="cluster-card"><header><i style="--cluster:var(--green)"></i><strong>Protocol role</strong><span>PROVE</span></header><p>Keep the evidence chain portable across tools, teams and time.</p></article></div></article></section>
    <div class="spacer"></div>
    <article class="panel panel-pad"><div class="panel-head"><div><span class="mini-label">SCHEMA CONTRACT</span><h2>Core portable fields</h2><p>Versioned JSON Schema lives in the repository and is exposed by the local API.</p></div><span class="badge purple">v1.0</span></div><div style="overflow-x:auto"><table class="schema-table"><thead><tr><th>FIELD</th><th>PURPOSE</th><th>DISCIPLINE</th></tr></thead><tbody>${fields.map(row => `<tr><td><code>${escapeHtml(row[0])}</code></td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join('')}</tbody></table></div></article>
  </div>`;
}

function render() {
  if (!app.data) {
    $('#view').innerHTML = '<div class="loading-screen"><div><div class="loader"></div><h2>Building the intelligence picture…</h2></div></div>';
    return;
  }
  const renderer = {
    command: renderCommand,
    inbox: renderInbox,
    radar: renderRadar,
    watchlists: renderWatchlists,
    sources: renderSources,
    'local-ai': renderLocalAi,
    brief: renderBrief,
    protocol: renderProtocol
  }[app.view] || renderCommand;
  $('#view').innerHTML = renderer();
  $('#currentLabel').textContent = views[app.view];
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === app.view));
  updateHeader();
}

function updateHeader() {
  if (!app.data) return;
  const { stats, ai } = app.data;
  $('#liveSignals').textContent = number(stats.signals);
  $('#livePriority').textContent = number(stats.priority);
  $('#liveSources').textContent = number(stats.active_sources);
  $('#liveAi').textContent = ai.available ? 'READY' : 'SAFE';
  const picker = $('#themePicker');
  const current = app.theme;
  picker.innerHTML = '<option value="all">All watch themes</option>' + app.data.themes.map(theme => `<option value="${theme.id}">${escapeHtml(theme.name)}</option>`).join('');
  picker.value = current;
}

function navigate(view) {
  if (!views[view]) return;
  app.view = view;
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  $('#sidebar').classList.remove('open');
  render();
  $('#view').focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: 'smooth' });
}

function modal({ eyebrow = 'RADARLINE', title, subtitle = '', body, footer = '' }) {
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalTitle').textContent = title;
  $('#modalSubtitle').textContent = subtitle;
  $('#modalBody').innerHTML = body;
  $('#modalFooter').innerHTML = footer;
  $('#modalBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modalBackdrop').hidden = true;
  document.body.style.overflow = '';
}

function showSignal(id) {
  const signal = app.data.signals.find(item => item.id === Number(id));
  if (!signal) return;
  const sourceUrl = safeUrl(signal.canonical_url);
  const scoreCells = [['Relevance', signal.relevance], ['Novelty', signal.novelty], ['Authority', signal.authority], ['Corroboration', signal.corroboration], ['Freshness', signal.freshness], ['Traceability', signal.traceability], ['Uncertainty', signal.uncertainty], ['Hype gap', signal.hype_gap], ['Confidence', signal.confidence], ['TRACE', signal.trace_score]];
  modal({
    eyebrow: `${signal.demo ? 'FICTIONAL DEMO' : 'SOURCE-BACKED SIGNAL'} · ${typeLabel(signal.signal_type)}`,
    title: signal.title,
    subtitle: `${signal.source_name || 'Manual capture'} · ${longDate(signal.published_at)}`,
    body: `<div class="signal-detail"><div class="detail-head"><span class="badge ${escapeHtml(signal.status)}">${escapeHtml(signal.status)}</span><span class="tag">${escapeHtml(signal.horizon.toUpperCase())}</span>${themeTags(signal, 5)}</div><p class="detail-copy">${escapeHtml(signal.excerpt || 'No captured excerpt.')}</p><div class="score-grid">${scoreCells.map(([label, value]) => `<div class="score-cell"><span>${label}</span><strong>${Number(value) || 0}</strong></div>`).join('')}</div><div class="analysis-box"><span>LOCAL INTERPRETATION · ${escapeHtml(signal.model || 'not analysed')}</span><p><strong>${escapeHtml(signal.ai_summary || 'No analysis yet.')}</strong></p><p>${escapeHtml(signal.why_it_matters || 'Run local analysis, then review the source before making a decision.')}</p></div>${signal.implications?.length ? `<div><span class="mini-label">IMPLICATIONS</span><ul>${signal.implications.map(item => `<li class="detail-copy">${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}<div class="formula">source: ${escapeHtml(signal.source_name || 'manual')}<br>published: ${escapeHtml(signal.published_at || 'unknown')}<br>observed: ${escapeHtml(signal.observed_at || 'unknown')}<br>content hash: ${escapeHtml(signal.content_hash || 'not recorded')}</div>${sourceUrl ? `<a class="button" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">Open original source ↗</a>` : ''}</div>`,
    footer: `<button class="button" data-action="triage" data-id="${signal.id}" data-status="WATCH">Watch</button><button class="button" data-action="triage" data-id="${signal.id}" data-status="INVESTIGATE">Investigate</button><button class="button dark" data-action="analyze-signal" data-id="${signal.id}">Analyze locally</button><button class="button primary" data-action="triage" data-id="${signal.id}" data-status="BRIEF">Add to brief</button>`
  });
}

function showCaptureModal() {
  const sourceOptions = app.data.sources.map(source => `<option value="${source.id}">${escapeHtml(source.name)}</option>`).join('');
  modal({
    eyebrow: 'HUMAN INTELLIGENCE INPUT',
    title: 'Capture a signal',
    subtitle: 'Preserve the original link and enough evidence for a later verification.',
    body: `<form id="captureForm" class="form-grid"><label class="field full"><span>SIGNAL TITLE *</span><input name="title" required maxlength="240" placeholder="What changed?"></label><label class="field"><span>SOURCE</span><select name="source_id"><option value="">Manual / unknown</option>${sourceOptions}</select></label><label class="field"><span>PUBLISHED</span><input name="published_at" type="datetime-local"></label><label class="field full"><span>CANONICAL URL</span><input name="canonical_url" type="url" placeholder="https://…"></label><label class="field"><span>AUTHOR / CREATOR</span><input name="author" maxlength="120" placeholder="Person or organisation"></label><label class="field"><span>AUTHORITY IF UNSOURCED</span><input name="authority" type="number" min="1" max="100" value="55"></label><label class="field full"><span>EVIDENCE EXCERPT</span><textarea name="excerpt" maxlength="4000" placeholder="Capture the factual material, not only your interpretation."></textarea></label></form>`,
    footer: '<button class="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit" form="captureForm">Save &amp; score</button>'
  });
}

function showSourceModal() {
  modal({
    eyebrow: 'SOURCE GOVERNANCE',
    title: 'Add a source',
    subtitle: 'RADARLINE supports public feeds, repositories, bounded web pages and manual curation.',
    body: `<form id="sourceForm" class="form-grid"><label class="field full"><span>SOURCE NAME *</span><input name="name" required maxlength="160" placeholder="e.g. Research Lab Releases"></label><label class="field"><span>CONNECTOR</span><select name="connector"><option value="rss">RSS / Atom / JSON Feed</option><option value="github">GitHub releases</option><option value="hackernews">Hacker News API</option><option value="web">Web page</option><option value="json">JSON Feed</option><option value="manual">Manual curation</option></select></label><label class="field"><span>KIND</span><select name="kind"><option value="publication">Publication</option><option value="research">Research</option><option value="repository">Repository</option><option value="community">Community</option><option value="creator">Creator</option><option value="policy">Policy</option></select></label><label class="field full"><span>PUBLIC URL</span><input name="url" type="url" placeholder="https://…"></label><label class="field"><span>AUTHORITY / 100</span><input name="authority" type="number" min="1" max="100" value="70"></label><label class="field"><span>CADENCE</span><select name="cadence"><option>hourly</option><option selected>daily</option><option>weekly</option><option>manual</option></select></label><label class="field"><span>CREATOR NAME</span><input name="creator_name" maxlength="120"></label><label class="field"><span>TOPIC</span><input name="topic" maxlength="180"></label></form>`,
    footer: '<button class="button" data-action="close-modal">Cancel</button><button class="button primary" type="submit" form="sourceForm">Add governed source</button>'
  });
}

async function refreshState() {
  app.data = await api('/api/state');
  render();
}

async function syncSources() {
  setBusy('sync', true);
  try {
    const result = await api('/api/sync', { method: 'POST', body: '{}' });
    app.data = { ...result.state, ai: app.data.ai };
    const added = result.results.reduce((sum, item) => sum + Number(item.new_count || 0), 0);
    const failures = result.results.filter(item => item.status === 'failed').length;
    toast(`Source sync complete: ${added} new signal${added === 1 ? '' : 's'}${failures ? `, ${failures} source error${failures === 1 ? '' : 's'}` : ''}.`);
    render();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setBusy('sync', false);
  }
}

async function analyzeBatch() {
  setBusy('analyze-batch', true);
  toast('Local analysis started. The model may need a moment.');
  try {
    const result = await api('/api/analyze/batch', { method: 'POST', body: JSON.stringify({ limit: 3 }) });
    app.data = { ...result.state, ai: result.ai };
    toast(`${result.signals.length} priority signal${result.signals.length === 1 ? '' : 's'} analysed locally.`);
    render();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setBusy('analyze-batch', false);
  }
}

async function analyzeOne(id) {
  setBusy('analyze-signal', true);
  try {
    const result = await api(`/api/signals/${id}/analyze`, { method: 'POST', body: '{}' });
    app.data = { ...result.state, ai: result.ai };
    toast('Signal analysed locally with its source boundary intact.');
    showSignal(id);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setBusy('analyze-signal', false);
  }
}

async function triage(id, status) {
  try {
    const result = await api(`/api/signals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    app.data = { ...result.state, ai: app.data.ai };
    toast(`Signal routed to ${status}.`);
    showSignal(id);
    updateHeader();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function generateBrief(period) {
  setBusy('generate-brief', true);
  try {
    const result = await api('/api/briefs', { method: 'POST', body: JSON.stringify({ period }) });
    app.data = { ...result.state, ai: app.data.ai };
    app.briefId = result.brief.id;
    closeModal();
    navigate('brief');
    toast(`${period === 'weekly' ? 'Weekly' : 'Daily'} brief generated locally.`);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setBusy('generate-brief', false);
  }
}

function download(path) {
  const anchor = document.createElement('a');
  anchor.href = path;
  anchor.download = '';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

document.addEventListener('click', event => {
  const viewControl = event.target.closest('[data-view]');
  if (viewControl) { navigate(viewControl.dataset.view); return; }
  const signalControl = event.target.closest('[data-signal]');
  if (signalControl) { showSignal(signalControl.dataset.signal); return; }
  const briefControl = event.target.closest('[data-brief]');
  if (briefControl) { app.briefId = Number(briefControl.dataset.brief); render(); return; }
  const statusControl = event.target.closest('[data-status]');
  if (statusControl) { app.status = statusControl.dataset.status; render(); return; }
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'close-modal') closeModal();
  else if (action === 'sync') syncSources();
  else if (action === 'capture-signal') showCaptureModal();
  else if (action === 'add-source') showSourceModal();
  else if (action === 'analyze-batch') analyzeBatch();
  else if (action === 'analyze-signal') analyzeOne(control.dataset.id);
  else if (action === 'triage') triage(control.dataset.id, control.dataset.status);
  else if (action === 'generate-brief') generateBrief(control.dataset.period || 'daily');
  else if (action === 'export-trace') download('/api/export/trace-1');
  else if (action === 'download-db') download('/api/database/download');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal();
  const interactive = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
  if (!interactive && /^[1-8]$/.test(event.key)) navigate(Object.keys(views)[Number(event.key) - 1]);
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.dataset?.signal) {
    event.preventDefault();
    showSignal(document.activeElement.dataset.signal);
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'signalSearch') {
    app.query = event.target.value;
    const position = event.target.selectionStart;
    render();
    const input = $('#signalSearch');
    input?.focus();
    input?.setSelectionRange(position, position);
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  if (event.target.id === 'captureForm') {
    const body = Object.fromEntries(new FormData(event.target));
    try {
      const result = await api('/api/signals/manual', { method: 'POST', body: JSON.stringify(body) });
      app.data = { ...result.state, ai: app.data.ai };
      closeModal();
      toast(`Signal captured with TRACE ${result.signal.trace_score}/100.`);
      if (app.view !== 'inbox') navigate('inbox'); else render();
    } catch (error) { toast(error.message, 'error'); }
  }
  if (event.target.id === 'sourceForm') {
    const body = Object.fromEntries(new FormData(event.target));
    try {
      const result = await api('/api/sources', { method: 'POST', body: JSON.stringify(body) });
      app.data = { ...result.state, ai: app.data.ai };
      closeModal();
      toast(`${result.source.name} added to the governed source network.`);
      render();
    } catch (error) { toast(error.message, 'error'); }
  }
});

$('#themePicker').addEventListener('change', event => { app.theme = event.target.value; render(); });
$('#openSidebar').addEventListener('click', () => $('#sidebar').classList.add('open'));
$('#closeSidebar').addEventListener('click', () => $('#sidebar').classList.remove('open'));
$('#modalBackdrop').addEventListener('click', event => { if (event.target === event.currentTarget) closeModal(); });
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'command'));

function updateClock() {
  $('#liveClock').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
}

async function init() {
  const requested = location.hash.slice(1);
  app.view = views[requested] ? requested : 'command';
  updateClock();
  setInterval(updateClock, 1000);
  try {
    await refreshState();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  } catch (error) {
    $('#view').innerHTML = `<div class="empty-state"><div><i>!</i><h2>RADARLINE could not start</h2><p>${escapeHtml(error.message)} Restart the local server and reload this page.</p></div></div>`;
  }
}

init();
