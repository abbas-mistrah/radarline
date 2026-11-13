'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  assert.ok(errors.includes('scores are required.'));
});

test('radarline check exits 0 on the example and 1 on an invalid file', () => {
  const ok = execFileSync(process.execPath, ['cli.js', 'check', example], { cwd: root, encoding: 'utf8' });
  assert.equal(JSON.parse(ok).valid, true);

  const bad = path.join(require('node:os').tmpdir(), `radarline-invalid-${process.pid}.json`);
  fs.writeFileSync(bad, JSON.stringify({ trace1_version: '1.0' }));
  try {
    const run = spawnSync(process.execPath, ['cli.js', 'check', bad], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).valid, false);
  } finally {
    fs.unlinkSync(bad);
  }
});

test('requiring the CLI as a module does not run a command', () => {
  const run = spawnSync(process.execPath, ['-e', "require('./cli.js')"], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});
