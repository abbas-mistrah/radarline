'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseXmlFeed,
  parseJsonFeed,
  assertPublicUrl,
  githubApiUrl
} = require('../src/connectors');

test('RSS and Atom payloads become bounded normalized evidence items', () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>Model &amp; runtime release</title><link>https://example.org/post</link><guid>post-1</guid><pubDate>Tue, 22 Sep 2026 08:00:00 GMT</pubDate><description><![CDATA[<p>A source-backed release note.</p>]]></description></item></channel></rss>`;
  const items = parseXmlFeed(rss, { name: 'Example feed' });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Model & runtime release');
  assert.equal(items[0].canonical_url, 'https://example.org/post');
  assert.equal(items[0].external_id, 'post-1');
  assert.match(items[0].content_hash, /^[a-f0-9]{64}$/);
});

test('JSON Feed keeps the canonical source fields', () => {
  const items = parseJsonFeed(JSON.stringify({ items: [{ id: '42', url: 'https://example.org/42', title: 'Structured release', content_text: 'Evidence body', date_published: '2026-09-22T08:00:00Z' }] }), { name: 'JSON feed' });
  assert.equal(items.length, 1);
  assert.equal(items[0].external_id, '42');
  assert.equal(items[0].excerpt, 'Evidence body');
});

test('connector boundary blocks local and credential-bearing URLs', () => {
  assert.throws(() => assertPublicUrl('http://127.0.0.1/private'), /Private network/);
  assert.throws(() => assertPublicUrl('https://user:pass@example.org/feed'), /credentials/);
  assert.equal(assertPublicUrl('https://example.org/feed').hostname, 'example.org');
});

test('GitHub repository links are converted to the public releases API', () => {
  assert.equal(githubApiUrl('https://github.com/ollama/ollama'), 'https://api.github.com/repos/ollama/ollama/releases?per_page=30');
});
