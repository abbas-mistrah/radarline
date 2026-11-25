'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'radarline-test-'));
process.env.RADARLINE_DB = path.join(temporaryDirectory, 'test.sqlite');
process.env.RADARLINE_PORT = '0';

const server = require('../server');
const database = require('../src/database');

test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function baseUrl() {
  return `http://127.0.0.1:${server.address().port}`;
}

test('health endpoint identifies service, protocol and database', async () => {
  const response = await fetch(`${baseUrl()}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'RADARLINE');
  assert.equal(health.protocol, 'TRACE-1');
});

test('state endpoint exposes seeded signals, themes and local database metadata', async () => {
  const response = await fetch(`${baseUrl()}/api/state`);
  const state = await response.json();
  assert.equal(response.status, 200);
  assert.equal(state.signals.length, 12);
  assert.equal(state.themes.length, 5);
  assert.equal(state.database.engine, 'SQLite');
  assert.equal(state.protocol.name, 'TRACE-1');
});

test('manual signal capture creates a scored, non-demo record', async () => {
  const response = await fetch(`${baseUrl()}/api/signals/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Local runtime publishes an auditable release',
      canonical_url: 'https://example.org/releases/1',
      author: 'Example Lab',
      excerpt: 'The release publishes an auditable structured-output runtime for local enterprise workflows.'
    })
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.signal.demo, false);
  assert.ok(payload.signal.trace_score > 0);
  assert.equal(payload.state.signals.length, 13);
});

test('TRACE export and schema remain machine-readable', async () => {
  const [exportResponse, schemaResponse] = await Promise.all([
    fetch(`${baseUrl()}/api/export/trace-1`),
    fetch(`${baseUrl()}/api/protocol`)
  ]);
  const exported = await exportResponse.json();
  const schema = await schemaResponse.json();
  assert.equal(exported.trace1_version, '1.0');
  assert.ok(exported.signals.length >= 12);
  assert.equal(schema.$id, 'https://github.com/abbas-mistrah/radarline/blob/main/protocol/trace-1.schema.json');
});

test('invalid input is a 400 client error, not a 500 server error', async () => {
  const post = (route, body) => fetch(`${baseUrl()}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  const cases = [
    ['/api/sources', '{"connector":"rss"}', 'Source name is required.'],
    ['/api/sources', '{"name":"Feed","connector":"ftp"}', 'Unsupported connector.'],
    ['/api/sources', '{"name":"Feed","connector":"rss"}', 'A URL is required for this connector.'],
    ['/api/signals/manual', '{}', 'Signal title is required.'],
    ['/api/signals/manual', 'null', 'Request body must be a JSON object.'],
    ['/api/sources', '[1]', 'Request body must be a JSON object.'],
    ['/api/sources', '{not json', 'Invalid JSON']
  ];
  for (const [route, body, message] of cases) {
    const response = await post(route, body);
    assert.equal(response.status, 400, `${route} ${body}`);
    assert.equal((await response.json()).error, message);
  }
});

test('a malformed Host header gets a response and does not crash the server', async () => {
  const net = require('node:net');
  const raw = await new Promise((resolve, reject) => {
    const socket = net.connect(server.address().port, '127.0.0.1', () => {
      socket.write('GET /api/health HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n');
    });
    let data = '';
    socket.on('data', chunk => { data += chunk; });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
  assert.match(raw, /^HTTP\/1\.1 (200|400) /);
  const health = await fetch(`${baseUrl()}/api/health`);
  assert.equal(health.status, 200);
});

test('syncing an unknown source answers 404', async () => {
  const response = await fetch(`${baseUrl()}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: 999999 })
  });
  assert.equal(response.status, 404);
  const health = await (await fetch(`${baseUrl()}/api/health`)).json();
  assert.equal(health.sync_in_progress, false);
});
