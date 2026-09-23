'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  db,
  databasePath,
  getState,
  getSources,
  getSignal,
  getSignals,
  getBrief,
  addSource,
  addManualSignal,
  saveFetchedItems,
  updateSignal,
  saveAnalysis,
  startSync,
  finishSync,
  createBrief,
  exportTrace
} = require('./src/database');
const { fetchSource } = require('./src/connectors');
const { getOllamaStatus, analyzeSignal } = require('./src/ai');

const port = Number(process.env.RADARLINE_PORT || process.env.PORT) || 4335;
const host = process.env.RADARLINE_HOST || process.env.HOST || '127.0.0.1';
const publicDirectory = path.join(__dirname, 'public');
let syncInProgress = false;
let analysisInProgress = false;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function send(response, status, body, type = 'text/plain; charset=utf-8', extraHeaders = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(payload);
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload, (_, value) => typeof value === 'bigint' ? Number(value) : value), 'application/json; charset=utf-8');
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON')); }
    });
    request.on('error', reject);
  });
}

async function synchronize(input = {}) {
  if (syncInProgress) throw new Error('A source sync is already running.');
  syncInProgress = true;
  const allSources = getSources().filter(item => item.active && item.connector !== 'manual');
  const selected = input.source_id ? allSources.filter(item => item.id === Number(input.source_id)) : allSources;
  if (!selected.length) {
    syncInProgress = false;
    throw new Error('No active automated source matches this request.');
  }
  const results = [];
  try {
    for (const source of selected.slice(0, 10)) {
      const runId = startSync(source.id);
      try {
        const items = await fetchSource(source);
        const result = saveFetchedItems(source.id, items);
        finishSync(runId, result);
        results.push({ source_id: source.id, source: source.name, status: 'completed', ...result });
      } catch (error) {
        finishSync(runId, {}, error.message);
        results.push({ source_id: source.id, source: source.name, status: 'failed', error: error.message });
      }
    }
    return results;
  } finally {
    syncInProgress = false;
  }
}

async function analyzeBatch(input = {}) {
  if (analysisInProgress) throw new Error('A local analysis run is already active.');
  analysisInProgress = true;
  const requested = Number(input.limit) || 3;
  const candidates = getSignals().filter(item => input.force || !item.analyzed_at)
    .filter(item => item.status !== 'IGNORE').slice(0, Math.max(1, Math.min(6, requested)));
  const sources = new Map(getSources().map(item => [item.id, item]));
  const output = [];
  try {
    for (const signal of candidates) {
      const analysis = await analyzeSignal(signal, sources.get(signal.source_id) || {});
      output.push(saveAnalysis(signal.id, analysis));
    }
    return output;
  } finally {
    analysisInProgress = false;
  }
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;
  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, {
      ok: true,
      service: 'RADARLINE',
      protocol: 'TRACE-1',
      database: path.basename(databasePath),
      sync_in_progress: syncInProgress,
      analysis_in_progress: analysisInProgress,
      time: new Date().toISOString()
    });
  }
  if (request.method === 'GET' && pathname === '/api/state') {
    const [state, ai] = await Promise.all([Promise.resolve(getState()), getOllamaStatus()]);
    return sendJson(response, 200, { ...state, ai, operations: { sync_in_progress: syncInProgress, analysis_in_progress: analysisInProgress } });
  }
  if (request.method === 'GET' && pathname === '/api/ai/status') return sendJson(response, 200, await getOllamaStatus());

  if (request.method === 'POST' && pathname === '/api/sources') {
    const source = addSource(await parseBody(request));
    return sendJson(response, 201, { source, state: getState() });
  }
  if (request.method === 'POST' && pathname === '/api/signals/manual') {
    const signal = addManualSignal(await parseBody(request));
    return sendJson(response, 201, { signal, state: getState() });
  }
  if (request.method === 'POST' && pathname === '/api/sync') {
    const results = await synchronize(await parseBody(request));
    return sendJson(response, 200, { results, state: getState() });
  }
  if (request.method === 'POST' && pathname === '/api/analyze/batch') {
    const signals = await analyzeBatch(await parseBody(request));
    return sendJson(response, 200, { signals, state: getState(), ai: await getOllamaStatus() });
  }

  const signalMatch = pathname.match(/^\/api\/signals\/(\d+)$/);
  if (signalMatch && request.method === 'PATCH') {
    const signal = updateSignal(Number(signalMatch[1]), await parseBody(request));
    return signal ? sendJson(response, 200, { signal, state: getState() }) : sendJson(response, 404, { error: 'Signal not found.' });
  }
  const analyzeMatch = pathname.match(/^\/api\/signals\/(\d+)\/analyze$/);
  if (analyzeMatch && request.method === 'POST') {
    const signal = getSignal(Number(analyzeMatch[1]));
    if (!signal) return sendJson(response, 404, { error: 'Signal not found.' });
    const source = getSources().find(item => item.id === signal.source_id) || {};
    const saved = saveAnalysis(signal.id, await analyzeSignal(signal, source));
    return sendJson(response, 200, { signal: saved, state: getState(), ai: await getOllamaStatus() });
  }

  if (request.method === 'POST' && pathname === '/api/briefs') {
    const input = await parseBody(request);
    const brief = createBrief(input.period === 'weekly' ? 'weekly' : 'daily');
    return sendJson(response, 201, { brief, state: getState() });
  }
  const briefMatch = pathname.match(/^\/api\/briefs\/(\d+)\/download$/);
  if (briefMatch && request.method === 'GET') {
    const brief = getBrief(Number(briefMatch[1]));
    if (!brief) return sendJson(response, 404, { error: 'Brief not found.' });
    const filename = `radarline-${brief.period}-brief-${brief.id}.md`;
    return send(response, 200, brief.body_md, 'text/markdown; charset=utf-8', { 'Content-Disposition': `attachment; filename="${filename}"` });
  }
  if (request.method === 'GET' && pathname === '/api/export/trace-1') {
    return send(response, 200, JSON.stringify(exportTrace(), null, 2), 'application/json; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="radarline-trace-1-export.json"'
    });
  }
  if (request.method === 'GET' && pathname === '/api/database/download') {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    return send(response, 200, fs.readFileSync(databasePath), 'application/vnd.sqlite3', {
      'Content-Disposition': 'attachment; filename="radarline.sqlite"'
    });
  }
  if (request.method === 'GET' && pathname === '/api/protocol') {
    const schema = fs.readFileSync(path.join(__dirname, 'protocol', 'trace-1.schema.json'));
    return send(response, 200, schema, 'application/schema+json; charset=utf-8');
  }
  return sendJson(response, 404, { error: 'API route not found.' });
}

function serveStatic(response, url, method) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  let decoded;
  try { decoded = decodeURIComponent(requested).replace(/^[/\\]+/, ''); } catch { return sendJson(response, 400, { error: 'Invalid path.' }); }
  const filePath = path.resolve(publicDirectory, decoded);
  if (!filePath.startsWith(publicDirectory + path.sep) && filePath !== path.join(publicDirectory, 'index.html')) {
    return sendJson(response, 403, { error: 'Access denied.' });
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (path.extname(requested)) return sendJson(response, 404, { error: 'File not found.' });
      return fs.readFile(path.join(publicDirectory, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) return sendJson(response, 404, { error: 'Page not found.' });
        return send(response, 200, method === 'HEAD' ? '' : fallback, 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
      });
    }
    const extension = path.extname(filePath).toLowerCase();
    const cache = ['.html', '.js', '.css', '.webmanifest'].includes(extension) ? 'no-cache' : 'public, max-age=86400';
    return send(response, 200, method === 'HEAD' ? '' : data, mimeTypes[extension] || 'application/octet-stream', { 'Cache-Control': cache });
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: 'Method not allowed.' });
    return serveStatic(response, url, request.method);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Payload too large' ? 413 : error.message === 'Invalid JSON' ? 400 :
      /already/.test(error.message) ? 409 : 500;
    return sendJson(response, status, { error: error.message || 'Internal error.' });
  }
});

if (require.main === module) {
  server.listen(port, host, () => {
    console.log('RADARLINE · Technology & AI Intelligence OS');
    console.log(`http://${host}:${port}`);
    console.log(`SQLite: ${databasePath}`);
    console.log('Local AI: Ollama (optional, structured outputs)');
  });
}

module.exports = server;
