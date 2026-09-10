'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(envPath, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
