'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { validateContract } = require('../cli');

const root = path.join(__dirname, '..');
const example = path.join(root, 'protocol', 'examples', 'local-model-release.trace.json');
const load = () => JSON.parse(fs.readFileSync(example, 'utf8'));

test('the shipped TRACE-1 example is a valid contract', () => {
  assert.deepEqual(validateContract(load()), { valid: true, errors: [] });
});

test('validateContract reports every missing or out-of-range field', () => {
  const contract = load();
  contract.trace1_version = '0.9';
  delete contract.signal.content_hash;
  contract.scores.relevance = 140;
  contract.scores.novelty = 'high';
  contract.evidence = {};
  const { valid, errors } = validateContract(contract);
  assert.equal(valid, false);
  assert.deepEqual(errors, [
    'trace1_version must be 1.0.',
    'signal.content_hash is required.',
    'scores.relevance must be between 0 and 100.',
    'scores.novelty must be between 0 and 100.',
    'evidence must be an array.'
  ]);
});

test('validateContract rejects an empty document without throwing', () => {
  const { valid, errors } = validateContract({});
  assert.equal(valid, false);
  assert.ok(errors.includes('signal is required.'));
  assert.ok(errors.includes('classification is required.'));
  assert.ok(errors.includes('scores are required.'));
});

test('validateContract requires classification, enums and the TRACE-1 score set', () => {
  const missing = load();
  delete missing.classification;
  delete missing.scores.trace;
  const missingResult = validateContract(missing);
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.errors.includes('classification is required.'));
  assert.ok(missingResult.errors.includes('scores.trace must be between 0 and 100.'));

  const invalid = load();
  invalid.classification = { type: 'UNKNOWN', status: 'MAYBE', horizon: 'soon' };
  const invalidResult = validateContract(invalid);
  assert.equal(invalidResult.valid, false);
  assert.deepEqual(
    invalidResult.errors.filter(item => item.startsWith('classification.')),
    [
      'classification.type is invalid.',
      'classification.status is invalid.',
      'classification.horizon is invalid.'
    ]
  );
});

test('validateContract rejects a scores array and incomplete evidence items', () => {
  const contract = load();
  contract.scores = [];
  contract.evidence = [{ role: 'primary' }, 'not-an-object'];
  const { valid, errors } = validateContract(contract);
  assert.equal(valid, false);
  assert.ok(errors.includes('scores are required.'));
  assert.ok(errors.includes('evidence[0].url is required.'));
  assert.ok(errors.includes('evidence[0].observed_at is required.'));
  assert.ok(errors.includes('evidence[1] must be an object.'));
});

test('radarline check exits 0 on the example and 1 on an invalid file', () => {
  const ok = execFileSync(process.execPath, ['cli.js', 'check', example], { cwd: root, encoding: 'utf8' });
  assert.equal(JSON.parse(ok).valid, true);

  const bad = path.join(os.tmpdir(), `radarline-invalid-${process.pid}.json`);
  fs.writeFileSync(bad, JSON.stringify({ trace1_version: '1.0' }));
  try {
    const run = spawnSync(process.execPath, ['cli.js', 'check', bad], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).valid, false);
  } finally {
    fs.unlinkSync(bad);
  }
});

test('radarline check reports a missing file or invalid JSON without throwing raw errors', () => {
  const missing = path.join(os.tmpdir(), `radarline-missing-${process.pid}.json`);
  const malformed = path.join(os.tmpdir(), `radarline-malformed-${process.pid}.json`);
  fs.writeFileSync(malformed, '{not json');
  try {
    const noFile = spawnSync(process.execPath, ['cli.js', 'check', missing], { cwd: root, encoding: 'utf8' });
    assert.equal(noFile.status, 1);
    assert.equal(noFile.stderr, '');
    const noFileResult = JSON.parse(noFile.stdout);
    assert.equal(noFileResult.valid, false);
    assert.equal(noFileResult.errors.length, 1);
    assert.match(noFileResult.errors[0], new RegExp(`^File not found: .*radarline-missing-${process.pid}\\.json$`));

    const badJson = spawnSync(process.execPath, ['cli.js', 'check', malformed], { cwd: root, encoding: 'utf8' });
    assert.equal(badJson.status, 1);
    assert.equal(badJson.stderr, '');
    const badJsonResult = JSON.parse(badJson.stdout);
    assert.equal(badJsonResult.valid, false);
    assert.equal(badJsonResult.errors.length, 1);
    assert.match(badJsonResult.errors[0], new RegExp(`^Invalid JSON in .*radarline-malformed-${process.pid}\\.json\\.$`));
  } finally {
    fs.unlinkSync(malformed);
  }
});

test('requiring the CLI as a module does not run a command', () => {
  const run = spawnSync(process.execPath, ['-e', "require('./cli.js')"], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});
