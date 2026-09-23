#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

function validateContract(contract) {
  const errors = [];
  if (contract.trace1_version !== '1.0') errors.push('trace1_version must be 1.0.');
  if (!contract.signal || typeof contract.signal !== 'object') errors.push('signal is required.');
  const signal = contract.signal || {};
  ['title', 'canonical_url', 'content_hash', 'published_at', 'observed_at'].forEach(key => {
    if (!signal[key]) errors.push(`signal.${key} is required.`);
  });
  if (!contract.scores || typeof contract.scores !== 'object') errors.push('scores are required.');
  for (const [key, value] of Object.entries(contract.scores || {})) {
    if (typeof value !== 'number' || value < 0 || value > 100) errors.push(`scores.${key} must be between 0 and 100.`);
  }
  if (!Array.isArray(contract.evidence)) errors.push('evidence must be an array.');
  return { valid: errors.length === 0, errors };
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
    const file = path.resolve(argument);
    const result = validateContract(JSON.parse(fs.readFileSync(file, 'utf8')));
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

main().catch(error => {
  console.error(`RADARLINE: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { validateContract };
