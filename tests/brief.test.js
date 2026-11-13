'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeMarkdown, signalLine, buildBrief } = require('../src/brief');

function signal(overrides = {}) {
  return {
    id: 1,
    title: 'Local model release',
    status: 'BRIEF',
    trace_score: 80,
    horizon: 'now',
    uncertainty: 10,
    hype_gap: 5,
    archived: 0,
    canonical_url: 'https://example.com/signal',
    excerpt: 'Short excerpt.',
    why_it_matters: 'Lowers infrastructure cost.',
    ...overrides
  };
}

test('escapeMarkdown neutralises Markdown control characters and empty values', () => {
  assert.equal(escapeMarkdown('v1.2 [beta] #1 *new*'), 'v1\\.2 \\[beta\\] \\#1 \\*new\\*');
  assert.equal(escapeMarkdown(null), '');
  assert.equal(escapeMarkdown(undefined), '');
});

test('signalLine falls back gracefully when summary, link or interpretation are missing', () => {
  const line = signalLine(signal({ canonical_url: '', excerpt: '', why_it_matters: '' }));
  assert.match(line, /source not attached/);
  assert.match(line, /Open the evidence to review this signal\./);
  assert.match(line, /Human interpretation required\./);
  assert.match(line, /BRIEF · TRACE 80\/100 · NOW/);
});

test('buildBrief ranks by TRACE score and drops archived or ignored signals', () => {
  const brief = buildBrief([
    signal({ id: 1, title: 'Low', trace_score: 40 }),
    signal({ id: 2, title: 'High', trace_score: 95 }),
    signal({ id: 3, title: 'Archived', trace_score: 99, archived: 1 }),
    signal({ id: 4, title: 'Ignored', trace_score: 98, status: 'IGNORE' })
  ]);
  assert.deepEqual(brief.signal_ids, [2, 1]);
  assert.equal(brief.model, 'deterministic-trace-1');
  assert.ok(brief.body_md.indexOf('High') < brief.body_md.indexOf('Low'));
  assert.doesNotMatch(brief.body_md, /Archived|Ignored/);
});

test('buildBrief caps the review at twelve signals and groups them by horizon', () => {
  const horizons = ['now', 'next', 'later'];
  const signals = Array.from({ length: 15 }, (_, index) =>
    signal({ id: index + 1, title: `Signal ${index + 1}`, trace_score: 100 - index, horizon: horizons[index % 3] }));
  const brief = buildBrief(signals, 'weekly');
  assert.equal(brief.signal_ids.length, 12);
  assert.match(brief.title, /^Weekly Intelligence Brief · /);
  assert.match(brief.body_md, /\*\*Signals reviewed:\*\* 12/);
  for (const heading of ['NOW — operating impact', 'NEXT — investigate and prepare', 'LATER — preserve optionality']) {
    assert.match(brief.body_md, new RegExp(`## ${heading}`));
  }
});

test('buildBrief sends high-uncertainty or hype-heavy signals to the verification queue', () => {
  const brief = buildBrief([
    signal({ id: 1, title: 'Solid', uncertainty: 10, hype_gap: 5 }),
    signal({ id: 2, title: 'Shaky', uncertainty: 60, hype_gap: 5 }),
    signal({ id: 3, title: 'Hyped', uncertainty: 10, hype_gap: 30 })
  ]);
  const queue = brief.body_md.split('## Verification queue')[1].split('## Decision discipline')[0];
  assert.match(queue, /Shaky/);
  assert.match(queue, /Hyped/);
  assert.doesNotMatch(queue, /Solid/);
  assert.match(brief.executive_summary, /2 carry material uncertainty or hype risk/);
});

test('an empty workspace produces an honest brief instead of failing', () => {
  const brief = buildBrief([]);
  assert.deepEqual(brief.signal_ids, []);
  assert.match(brief.executive_summary, /No decision-ready signals are available yet/);
  assert.match(brief.body_md, /No prioritized signal\./);
  assert.doesNotMatch(brief.body_md, /## Verification queue/);
});
