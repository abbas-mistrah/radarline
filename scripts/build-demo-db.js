'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const databaseDirectory = path.join(projectRoot, 'database');
const target = path.join(databaseDirectory, 'radarline-demo.sqlite');

fs.mkdirSync(databaseDirectory, { recursive: true });
if (fs.existsSync(target)) fs.unlinkSync(target);

process.env.RADARLINE_DB = target;
const database = require('../src/database');
database.createBrief('daily');
database.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
database.close();

const size = fs.statSync(target).size;
console.log(`RADARLINE demo database rebuilt: ${path.relative(projectRoot, target)} (${size} bytes)`);
