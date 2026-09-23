'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clamp,
  similarity,
  freshnessScore,
  classifySignal,
  keywordMatches,
  scoreSignal
} = require('../src/scoring');

test('clamp keeps scores inside the public 0–100 contract', () => {
  assert.equal(clamp(-4), 0);
  assert.equal(clamp(54.6), 55);
  assert.equal(clamp(108), 100);
});

test('similarity detects overlap without treating distinct signals as duplicates', () => {
  assert.ok(similarity('Local AI inference runtime', 'Local AI runtime release') > 0.4);
  assert.equal(similarity('GPU inference', 'policy retention duties'), 0);
});

test('freshness score decays in explicit bands', () => {
  const now = new Date('2026-09-23T12:00:00Z');
  assert.equal(freshnessScore('2026-09-23T08:00:00Z', now), 100);
  assert.equal(freshnessScore('2026-09-15T08:00:00Z', now), 58);
  assert.equal(freshnessScore('not-a-date', now), 20);
});

test('classification and watch-theme matching are deterministic', () => {
  assert.equal(classifySignal('New security study describes a prompt injection attack'), 'RESEARCH_BREAKTHROUGH');
  const matches = keywordMatches('Local inference runtime for an offline laptop', [{
    id: 1,
    include_keywords: 'local,inference,runtime',
    exclude_keywords: 'gaming'
  }]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].hits, 3);
});

test('TRACE score rewards complete, relevant evidence', () => {
  const complete = scoreSignal({
    title: 'Local inference runtime released for enterprise workflows',
    excerpt: 'A documented runtime is available with reproducible structured outputs and a public benchmark.',
    canonical_url: 'https://example.org/release',
    content_hash: 'abc123',
    author: 'Example Lab',
    published_at: '2026-09-23T08:00:00Z',
    source_name: 'Example Lab',
    authority: 94,
    corroboration: 82,
    novelty: 86
  }, {
    now: new Date('2026-09-23T12:00:00Z'),
    themes: [{ id: 1, name: 'Local AI', include_keywords: 'local,inference,runtime,enterprise', exclude_keywords: '' }]
  });
  const incomplete = scoreSignal({ title: 'Someone says AI changed everything' }, { now: new Date('2026-09-23T12:00:00Z') });
  assert.ok(complete.trace_score > incomplete.trace_score);
  assert.equal(complete.traceability, 100);
  assert.ok(['BRIEF', 'INVESTIGATE'].includes(complete.status));
});
