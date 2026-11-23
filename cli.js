#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SIGNAL_FIELDS = ['title', 'canonical_url', 'content_hash', 'published_at', 'observed_at'];
const SCORE_FIELDS = [
  'relevance', 'novelty', 'authority', 'corroboration',
  'freshness', 'traceability', 'uncertainty', 'trace'
];
const CLASSIFICATION_TYPES = [
  'MODEL_RELEASE', 'PRODUCT_LAUNCH', 'RESEARCH_BREAKTHROUGH', 'REGULATION',
  'SECURITY', 'BUSINESS_MOVE', 'CREATOR_INSIGHT', 'INFRASTRUCTURE', 'FUNDING', 'OTHER'
];
const CLASSIFICATION_STATUSES = ['IGNORE', 'WATCH', 'INVESTIGATE', 'BRIEF', 'ACT'];
const CLASSIFICATION_HORIZONS = ['now', 'next', 'later'];

function help() {
  console.log(`RADARLINE · Technology & AI Intelligence OS

Usage:
  radarline serve                  Start the local workspace
  radarline doctor                 Check SQLite, sources and local AI
  radarline sync [source-id]       Fetch active public sources
  radarline brief [daily|weekly]   Generate a TRACE-1 intelligence brief
  radarline export [file]          Export the full TRACE-1 evidence ledger
  radarline check <file>           Validate a TRACE-1 signal contract

No cloud account is required. Ollama is optional and runs on localhost.`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateContract(contract) {
  if (!isPlainObject(contract)) {
    return { valid: false, errors: ['The document must be a JSON object.'] };
  }

  const errors = [];
  if (contract.trace1_version !== '1.0') errors.push('trace1_version must be 1.0.');

  if (!isPlainObject(contract.signal)) errors.push('signal is required.');
  const signal = isPlainObject(contract.signal) ? contract.signal : {};
  SIGNAL_FIELDS.forEach(key => {
    if (!signal[key]) errors.push(`signal.${key} is required.`);
  });

  if (!isPlainObject(contract.classification)) {
    errors.push('classification is required.');
  } else {
    if (!CLASSIFICATION_TYPES.includes(contract.classification.type)) {
      errors.push('classification.type is invalid.');
    }
    if (!CLASSIFICATION_STATUSES.includes(contract.classification.status)) {
      errors.push('classification.status is invalid.');
    }
    if (!CLASSIFICATION_HORIZONS.includes(contract.classification.horizon)) {
      errors.push('classification.horizon is invalid.');
    }
  }

  if (!isPlainObject(contract.scores)) {
    errors.push('scores are required.');
  } else {
    const keys = new Set([...SCORE_FIELDS, ...Object.keys(contract.scores)]);
    for (const key of keys) {
      const value = contract.scores[key];
      if (typeof value !== 'number' || value < 0 || value > 100) {
        errors.push(`scores.${key} must be between 0 and 100.`);
      }
    }
  }

  if (!Array.isArray(contract.evidence)) {
    errors.push('evidence must be an array.');
  } else {
    contract.evidence.forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`evidence[${index}] must be an object.`);
        return;
      }
      if (!item.url) errors.push(`evidence[${index}].url is required.`);
      if (!item.observed_at) errors.push(`evidence[${index}].observed_at is required.`);
    });
  }

  return { valid: errors.length === 0, errors };
}

function checkFile(filePath) {
  const file = path.resolve(filePath);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { valid: false, errors: [`File not found: ${file}`] };
    throw error;
  }

  let contract;
  try {
    contract = JSON.parse(raw);
  } catch {
    return { valid: false, errors: [`Invalid JSON in ${file}.`] };
  }

  return validateContract(contract);
}

async function main() {
  const [command = 'help', argument] = process.argv.slice(2);
  if (['help', '--help', '-h'].includes(command)) return help();
  if (command === 'serve') {
    const server = require('./server');
    const port = Number(process.env.RADARLINE_PORT || process.env.PORT) || 4335;
    const host = process.env.RADARLINE_HOST || process.env.HOST || '127.0.0.1';
    server.listen(port, host, () => console.log(`RADARLINE is live at http://${host}:${port}`));
    return;
  }
  if (command === 'check') {
    if (!argument) throw new Error('Provide a TRACE-1 JSON file.');
    const result = checkFile(argument);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
    return;
  }

  const database = require('./src/database');
  if (command === 'doctor') {
    const { getOllamaStatus } = require('./src/ai');
    const state = database.getState();
    const ai = await getOllamaStatus();
    console.log(JSON.stringify({
      ok: true,
      database: state.database,
      signals: state.stats.signals,
      active_sources: state.stats.active_sources,
      protocol: state.protocol,
      local_ai: ai
    }, null, 2));
    return;
  }
  if (command === 'sync') {
    const { fetchSource } = require('./src/connectors');
    const sources = database.getSources().filter(item => item.active && item.connector !== 'manual')
      .filter(item => !argument || item.id === Number(argument));
    if (!sources.length) throw new Error('No active automated source matches this request.');
    const results = [];
    for (const source of sources) {
      const runId = database.startSync(source.id);
      try {
        const saved = database.saveFetchedItems(source.id, await fetchSource(source));
        database.finishSync(runId, saved);
        results.push({ source: source.name, status: 'completed', ...saved });
      } catch (error) {
        database.finishSync(runId, {}, error.message);
        results.push({ source: source.name, status: 'failed', error: error.message });
      }
    }
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (command === 'brief') {
    const brief = database.createBrief(argument === 'weekly' ? 'weekly' : 'daily');
    console.log(brief.body_md);
    return;
  }
  if (command === 'export') {
    const target = path.resolve(argument || `radarline-trace-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(target, JSON.stringify(database.exportTrace(), null, 2));
    console.log(target);
    return;
  }
  help();
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`RADARLINE: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { validateContract, checkFile };
